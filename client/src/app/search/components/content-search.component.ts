import { Component, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { flatten, isNil } from 'lodash-es';
import { combineLatest, Observable, of, ReplaySubject, Subject } from 'rxjs';
import { map, mergeMap, scan, shareReplay, take, takeUntil, tap } from 'rxjs/operators';

import { HighlightDisplayLimitChange } from 'app/file-browser/components/object-info.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { getObjectMatchExistingTab } from 'app/file-browser/utils/objects';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { PdfViewComponent } from 'app/pdf-viewer/components/pdf-view.component';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleAwareComponent } from 'app/shared/schemas/modules';
import { RankedItem, SearchableRequestOptions } from 'app/shared/schemas/common';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { uuidv4 } from 'app/shared/utils';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { FindOptions } from 'app/shared/utils/find';
import { WorkspaceManager } from 'app/workspace/services/workspace-manager';
import { getPath } from 'app/shared/utils/files';
import { TRACKING_ACTIONS, TRACKING_CATEGORIES } from 'app/shared/constants/tracking';
import { TrackingService } from 'app/shared/services/tracking.service';
import { filesystemObjectLoadingMock } from 'app/shared/mocks/loading/file';
import { rankedItemLoadingMock } from 'app/shared/mocks/loading/common';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';
import { getURLFromSnapshot } from 'app/shared/utils/router';
import { updateSubject } from 'app/shared/rxjs/update';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { RejectedOptionsDialogComponent } from './rejected-options-dialog.component';
import { SynonymSearchComponent } from './synonym-search.component';
import { ContentSearchOptions } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { SearchType } from '../shared';
import { ContentSearchResponse } from '../schema';
import {
  ContentSearchParameters,
  ContentSearchQueryParameters,
  createContentSearchParamsFromQuery,
  getContentSearchQueryParams,
} from '../utils/search';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
  styleUrls: ['./content-search.component.scss'],
})
export class ContentSearchComponent
  extends PaginatedResultListComponent<ContentSearchParameters, RankedItem<FilesystemObject>>
  implements OnInit, OnDestroy, ModuleAwareComponent
{
  @Input() snippetAnnotations = false; // false due to LL-2052 - Remove annotation highlighting
  @Output() modulePropertiesChange = this.loadTask.values$.pipe(
    map((value: ContentSearchOptions) => ({
      title: value.q.length ? `Search: ${value.q}` : 'Search',
      fontAwesomeIcon: 'search',
    }))
  );

  private readonly DEFAULT_LIMIT = 20;
  readonly id = uuidv4(); // Used in the template to prevent duplicate ids across panes

  readonly loadedResults$: Observable<CollectionModel<RankedItem<FilesystemObject>>> =
    this.resultList$.pipe(
      scan(
        (model, { results }) => {
          model.replace(results);
          return model;
        },
        new CollectionModel<RankedItem<FilesystemObject>>(
          mockArrayOf(() => rankedItemLoadingMock(filesystemObjectLoadingMock())),
          { multipleSelection: false }
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  highlightTerms: string[] = [];
  highlightOptions: FindOptions = { keepSearchSpecialChars: true, wholeWord: true };
  readonly searchTypes$: Observable<SearchType[]> = this.objectTypeService.all().pipe(
    map((providers) => flatten(providers.map((provider) => provider.getSearchTypes()))),
    shareReplay({ refCount: true, bufferSize: 1 })
  );
  readonly searchTypesMap$: Observable<Map<string, SearchType>> = this.searchTypes$.pipe(
    map(
      (searchTypes) => new Map(searchTypes.map((searchType) => [searchType.shorthand, searchType]))
    ),
    shareReplay({ refCount: true, bufferSize: 1 })
  );
  readonly queryString$ = new ReplaySubject<string>(1);
  readonly emptyParams$ = this.params$.pipe(
    map((params) => this.areParamsEmpty(params)),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  constructor(
    private modalService: NgbModal,
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly contentSearchService: ContentSearchService,
    protected readonly zone: NgZone,
    protected readonly errorHandler: ErrorHandler,
    protected readonly messageDialog: MessageDialog,
    protected readonly objectTypeService: ObjectTypeService,
    private readonly tracking: TrackingService
  ) {
    super(route, workspaceManager);

    this.route.queryParams
      .pipe(
        mergeMap((params) => this.deserializeParams(params as ContentSearchQueryParameters)),
        map((params) => this.getQueryStringFromParams(params)),
        takeUntil(this.destroy$)
      )
      .subscribe(this.queryString$);
  }

  areParamsEmpty(params) {
    if (isNil(params)) {
      return true;
    }
    const qExists = params.hasOwnProperty('q') && params.q.length !== 0;
    const typesExists = params.hasOwnProperty('types') && params.types.length !== 0;
    const foldersExists = params.hasOwnProperty('folders') && params.folders.length !== 0;

    return !(qExists || typesExists || foldersExists);
  }

  ngOnInit() {
    super.ngOnInit();
  }

  getBreadCrumbsTitle(object: FilesystemObject): string {
    return getPath(object)
      .map((item) => item.effectiveName)
      .join(' > ');
  }

  getResults(params: ContentSearchOptions): Observable<ContentSearchResponse> {
    // No point sending a request if the params are completely empty
    if (this.areParamsEmpty(params)) {
      return of({
        total: 0,
        results: [],
        synonyms: {},
        droppedFolders: [],
      });
    }
    const serialisedParams = this.serializeParams(params);
    this.tracking.register({
      category: TRACKING_CATEGORIES.search,
      action: TRACKING_ACTIONS.search,
      label: JSON.stringify(serialisedParams),
      url: getURLFromSnapshot(this.route.snapshot).toString(),
    });
    return this.contentSearchService.search(serialisedParams).pipe(
      this.errorHandler.create({ label: 'Content search' }),
      tap((response) => {
        this.highlightTerms = response.query.phrases;
        const rejectedFolders: string[] = response.droppedFolders;

        if (rejectedFolders.length) {
          this.openRejectedOptions(rejectedFolders);
        }
      })
    );
  }

  getDefaultParams() {
    return {
      limit: this.DEFAULT_LIMIT,
      page: 1,
      sort: '+name',
      q: '',
    };
  }

  getQueryStringFromParams(params: ContentSearchOptions) {
    const q = [];
    if (params.hasOwnProperty('q') && params.q !== '') {
      q.push(params.q);
    }
    if (params.hasOwnProperty('types')) {
      if (params.types.length) {
        q.push(`(${params.types.map((type) => `type:${type.shorthand}`).join(' OR ')})`);
      }
    }
    return q.join(' ');
  }

  deserializeParams(params: ContentSearchQueryParameters): Observable<ContentSearchParameters> {
    return this.searchTypesMap$.pipe(
      take(1),
      map((searchTypesMap) =>
        createContentSearchParamsFromQuery(params, {
          defaultLimit: this.DEFAULT_LIMIT,
          searchTypesMap,
        })
      )
    );
  }

  serializeParams(
    params: ContentSearchParameters,
    restartPagination = false
  ): ContentSearchQueryParameters {
    return getContentSearchQueryParams(params, restartPagination);
  }

  search(form: SearchableRequestOptions) {
    this.workspaceManager.navigate(
      this.route.snapshot.url.map((item) => item.path),
      {
        queryParams: {
          ...this.serializeParams(
            {
              ...this.getDefaultParams(),
              // If normal search, only use the 'q' form value; Ignore any advanced params we arrived at the page with
              q: isNil(form.q) ? '' : form.q,
            },
            true
          ),
          t: new Date().getTime(),
        },
      }
    );
  }

  /**
   * Special version of search which handles the existence of advanced query params.
   * @param params Object representing the search query options.
   */
  advancedSearch(params: ContentSearchOptions) {
    this.workspaceManager.navigate(
      this.route.snapshot.url.map((item) => item.path),
      {
        queryParams: {
          ...this.serializeParams(
            {
              ...this.getDefaultParams(),
              // If advanced search, use all params
              ...params,
            },
            true
          ),
          t: new Date().getTime(),
        },
      }
    );
  }

  highlightClicked(object: FilesystemObject, highlight: string) {
    const parser = new DOMParser();
    const text = parser.parseFromString(highlight, 'application/xml').documentElement.textContent;
    const commands = object.getCommands(false);
    this.workspaceManager.navigate(commands, {
      matchExistingTab: getObjectMatchExistingTab(object),
      shouldReplaceTab: (component) => {
        if (object.type === 'file') {
          const pdfViewComponent = component as PdfViewComponent;
          pdfViewComponent.scrollInPdf({
            pageNumber: null,
            rect: null,
            jumpText: text,
          });
        }
        return false;
      },
      fragment: `jump=${encodeURIComponent(text)}`,
      newTab: true,
      sideBySide: true,
    });
  }

  highlightDisplayLimitChanged(object: DirectoryObject, change: HighlightDisplayLimitChange) {
    if (this.snippetAnnotations) {
      const queue: {
        index: number;
        text: string;
      }[] = [];

      if (!object.highlightAnnotated) {
        object.highlightAnnotated = [];
      }

      for (let i = change.previous; i < change.limit; i++) {
        if (!object.highlightAnnotated[i]) {
          queue.push({
            index: i,
            text: object.highlight[i],
          });
        }
      }

      if (queue.length) {
        this.contentSearchService
          .annotate({
            texts: queue.map((item) => item.text),
          })
          .subscribe((result) => {
            this.zone.run(() => {
              for (let i = 0, j = change.previous; j < change.limit; i++, j++) {
                const index = queue[i].index;
                object.highlight[index] = result.texts[i];
                object.highlightAnnotated[index] = true;
              }
            });
          });
      }
    }
  }

  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(false), {
      newTab: true,
    });
  }

  /**
   * Attempts to extract advanced search options from the query string paramter 'q'. If any advanced options are found, they are removed
   * from 'q' and added to the params object.
   * @param params object representing the content search options
   * @deprecated This method probably won't behave as expected with the introduction of the more complicated search expressions. E.g.,
   * "(type:A OR type:B) human" will result in a query string "( OR human", and will only identify type:A. Rather than implement a
   * complicated parser, the current implementation simply opts to not extract the options from the query string, in favor of the user
   * re-selecting them by hand.
   */
  // Not used?
  // extractAdvancedParamsFromString(q: string) {
  //   return promiseOfOne(
  //     combineLatest([
  //       this.searchTypesMap$,
  //       this.params$,
  //     ]),
  //   ).then(([searchTypesMap, params]) => {
  //     const advancedParams: ContentSearchOptions = {};
  //
  //     // Remove 'types' from q and add to the types option of the advancedParams
  //     const typeMatches = q.match(/\btype:\S*/g);
  //     const extractedTypes =
  //       typeMatches == null ? [] : typeMatches.map((typeVal) => typeVal.split(':')[1]);
  //     advancedParams.types = getChoicesFromQuery(
  //       {types: extractedTypes.join(';')},
  //       'types',
  //       searchTypesMap,
  //     );
  //     q = q.replace(/\btype:\S*/g, '');
  //
  //     // Remove 'folders' from q and add to the folders option of the advancedParams
  //     // const folderMatches = q.match(/\bfolder:\S*/g);
  //     // const extractedFilepaths = folderMatches === null ? [] : folderMatches.map(projectVal => projectVal.split(':')[1]);
  //     // advancedParams.folders = extractedFilepaths;
  //     // q = q.replace(/\bfolder:\S*/g, '');
  //     // TODO: If we ever want to put folders back into the query string, uncomment the above
  //     advancedParams.folders = params.folders || [];
  //
  //     // Do one last whitespace replacement to clean up the query string
  //     q = q.replace(/\s+/g, ' ').trim();
  //
  //     advancedParams.q = q;
  //
  //     return advancedParams;
  //   });
  // }

  /**
   * Opens the advanced search dialog. Users can add special options to their query using this feature.
   */
  openAdvancedSearch() {
    const modalRef = this.modalService.open(AdvancedSearchDialogComponent, {
      size: 'md',
    });
    const destroyModal$ = new Subject();
    // Get the starting options from the content search form query
    combineLatest([this.params$, this.queryString$])
      .pipe(takeUntil(destroyModal$))
      .subscribe(([{ folders }, q]) => {
        modalRef.componentInstance.params = {
          q,
          folders,
        } as ContentSearchOptions;
      });
    this.searchTypes$.pipe(takeUntil(destroyModal$)).subscribe((searchTypes) => {
      modalRef.componentInstance.typeChoices = searchTypes
        .concat()
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    modalRef.result
      // Advanced search was triggered
      .then((params: ContentSearchOptions) => {
        this.advancedSearch(params);
      })
      // Advanced search dialog was dismissed or rejected
      .catch((params: ContentSearchOptions) => {
        this.queryString$.next(this.getQueryStringFromParams(params));
      })
      .finally(() => {
        destroyModal$.next();
        destroyModal$.complete();
      });
  }

  /**
   * Opens the synonym search dialog. Users can search for synonyms of a term and add them to the current query.
   */
  openSynonymSearch() {
    const modalRef = this.modalService.open(SynonymSearchComponent, {
      size: 'lg',
    });
    modalRef.result
      // Synonym search was submitted
      .then((expressionsToAdd: string[]) =>
        updateSubject(
          this.queryString$,
          (queryString) =>
            (isNil(queryString) ? '' : `${queryString} `) + expressionsToAdd.join(' ')
        )
      )
      // Synonym search dialog was dismissed or rejected
      .catch(() => {});
  }

  /**
   * Opens the rejected options dialog. This will show the user any erroneous search inputs, if any.
   */
  openRejectedOptions(rejectedFolders: string[]) {
    const modalRef = this.modalService.open(RejectedOptionsDialogComponent, {
      size: 'md',
    });
    // Get the starting options from the content search form query
    modalRef.componentInstance.rejectedFolders = rejectedFolders;
    modalRef.result
      // Currently there's no "Submit" action on this dialog, but maybe we'll add one later
      .then(() => {})
      // Rejected options dialog was dismissed or rejected
      .catch(() => {});
  }

  itemDragStart(event: DragEvent, object: FilesystemObject, force = false) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    if (force || !dataTransfer.types.includes('text/uri-list')) {
      object.addDataTransferData(dataTransfer);
    }
  }
}
