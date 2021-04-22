import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { flatten } from 'lodash';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { HighlightDisplayLimitChange } from 'app/file-browser/components/object-info.component';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  ObjectTypeProvider,
  ObjectTypeService,
} from 'app/file-browser/services/object-type.service';
import { getObjectMatchExistingTab } from 'app/file-browser/utils/objects';
import { PDFResult, PDFSnippets } from 'app/interfaces';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { FileViewComponent } from 'app/pdf-viewer/components/file-view.component';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleProperties } from 'app/shared/modules';
import { RankedItem, ResultList } from 'app/shared/schemas/common';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { FindOptions } from 'app/shared/utils/find';
import {
  deserializePaginatedParams,
  getChoicesFromQuery,
  serializePaginatedParams,
} from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { ContentSearchOptions } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { SearchType } from '../shared';
import { GenericDataProvider } from '../../shared/providers/data-transfer-data/generic-data.provider';


@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
  styleUrls: ['./content-search.component.scss'],
})
export class ContentSearchComponent extends PaginatedResultListComponent<ContentSearchOptions,
  RankedItem<FilesystemObject>> implements OnInit, OnDestroy {
  @Input() snippetAnnotations = false; // false due to LL-2052 - Remove annotation highlighting
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  private readonly defaultLimit = 20;
  public results = new CollectionModel<RankedItem<FilesystemObject>>([], {
    multipleSelection: false,
  });
  fileResults: PDFResult = {hits: [{} as PDFSnippets], maxScore: 0, total: 0};
  highlightOptions: FindOptions = {keepSearchSpecialChars: true, wholeWord: true};
  searchTypes: SearchType[];
  searchTypesMap: Map<string, SearchType>;

  contentSearchFormVal: ContentSearchOptions;

  get emptyParams(): boolean {
    if (isNullOrUndefined(this.params)) {
      return true;
    }
    const qExists = this.params.hasOwnProperty('q') && this.params.q.length !== 0;
    const typesExists = this.params.hasOwnProperty('types') && this.params.types.length !== 0;
    const projectsExists = this.params.hasOwnProperty('projects') && this.params.projects.length !== 0;
    const phraseExists = this.params.hasOwnProperty('phrase') && this.params.phrase.length !== 0;
    const wildcardExists = this.params.hasOwnProperty('wildcards') && this.params.wildcards.length !== 0;

    return !(qExists || typesExists || projectsExists || phraseExists || wildcardExists);
  }

  constructor(private modalService: NgbModal,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService,
              protected readonly zone: NgZone,
              protected readonly errorHandler: ErrorHandler,
              protected readonly messageDialog: MessageDialog,
              protected readonly objectTypeService: ObjectTypeService) {
    super(route, workspaceManager);
    objectTypeService.all().subscribe((providers: ObjectTypeProvider[]) => {
      this.searchTypes = flatten(providers.map(provider => provider.getSearchTypes()));
      this.searchTypesMap = new Map(Array.from(this.searchTypes.values()).map(value => [value.shorthand, value]));
    });
  }

  valueChanged(value: ContentSearchOptions) {
    this.modulePropertiesChange.emit({
      title: value.q.length ? `Search: ${value.q}` : 'Search',
      fontAwesomeIcon: 'search',
    });
  }


  getResults(params: ContentSearchOptions): Observable<ResultList<RankedItem<FilesystemObject>>> {
    return this.contentSearchService.search(this.serializeParams(params)).pipe(
      this.errorHandler.create({label: 'Content search'}),
      map(result => ({
        query: result.query,
        total: result.collectionSize,
        results: [...result.results.items],
      })),
    );
  }

  getDefaultParams() {
    return {
      limit: this.defaultLimit,
      page: 1,
      sort: '+name',
      q: '',
    };
  }

  deserializeAdvancedParams(params) {
    const advancedParams: any = {};

    if (params.hasOwnProperty('types')) {
      advancedParams.types = getChoicesFromQuery(params, 'types', this.searchTypesMap);
    }
    if (params.hasOwnProperty('projects')) {
      advancedParams.projects = params.projects === '' ? [] : params.projects.split(';');
    }
    if (params.hasOwnProperty('phrase')) {
      advancedParams.phrase = params.phrase;
    }
    if (params.hasOwnProperty('wildcards')) {
      advancedParams.wildcards = params.wildcards;
    }
    return advancedParams;
  }

  deserializeParams(params) {
    return of({
      ...deserializePaginatedParams(params, this.defaultLimit),
      ...this.deserializeAdvancedParams(params),
      q: params.hasOwnProperty('q') ? params.q : '',
    });
  }

  serializeAdvancedParams(params: ContentSearchOptions) {
    const advancedParams: any = {};

    if (params.hasOwnProperty('types')) {
      advancedParams.types = params.types.map(value => value.shorthand).join(';');
    }
    if (params.hasOwnProperty('projects')) {
      advancedParams.projects = params.projects.join(';');
    }
    if (params.hasOwnProperty('phrase')) {
      advancedParams.phrase = params.phrase;
    }
    if (params.hasOwnProperty('wildcards')) {
      advancedParams.wildcards = params.wildcards;
    }
    return advancedParams;
  }

  serializeParams(params: ContentSearchOptions, restartPagination = false) {
    return {
      ...serializePaginatedParams(params, restartPagination),
      ...this.serializeAdvancedParams(params),
      q: params.hasOwnProperty('q') ? params.q : '',
    };
  }

  contentSearchFormChanged(form: ContentSearchOptions) {
    this.contentSearchFormVal = form;
  }

  search(form: ContentSearchOptions) {
    this.workspaceManager.navigate(this.route.snapshot.url.map(item => item.path), {
      queryParams: {
        ...this.serializeParams({
          ...this.getDefaultParams(),
          // If normal search, only use the 'q' form value; Ignore any advanced params we arrived at the page with
          q: isNullOrUndefined(form.q) ? '' : form.q,
        }, true),
        t: new Date().getTime(),
      },
    });
  }

  /**
   * Special version of search which handles the existence of advanced query params.
   * @param params object representing the search query options
   */
  advancedSearch(params) {
    this.workspaceManager.navigate(this.route.snapshot.url.map(item => item.path), {
      queryParams: {
        ...this.serializeParams({
          ...this.getDefaultParams(),
          // If advanced search, use all params
          ...params,
        }, true),
        t: new Date().getTime(),
      },
    });
  }

  highlightClicked(object: FilesystemObject, highlight: string) {
    const parser = new DOMParser();
    const text = parser.parseFromString(highlight, 'application/xml').documentElement.textContent;
    const commands = object.getCommands(false);
    this.workspaceManager.navigate(commands, {
      matchExistingTab: getObjectMatchExistingTab(object),
      shouldReplaceTab: component => {
        if (object.type === 'file') {
          const fileViewComponent = component as FileViewComponent;
          fileViewComponent.scrollInPdf({
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
        index: number,
        text: string,
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
        this.contentSearchService.annotate({
          texts: queue.map(item => item.text),
        }).subscribe(result => {
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
   */
  extractAdvancedParams(params: ContentSearchOptions) {
    const advancedParams: ContentSearchOptions = {};
    let q = isNullOrUndefined(params.q) ? '' : params.q;

    // Remove 'types' from q and add to the types option of the advancedParams
    const typeMatches = q.match(/\btype:\S*/g);
    const extractedTypes = typeMatches == null ? [] : typeMatches.map(typeVal => typeVal.split(':')[1]);
    const givenTypes = isNullOrUndefined(params.types) ? [] : params.types.map(value => value.shorthand);

    q = q.replace(/\btype:\S*/g, '');
    advancedParams.types = getChoicesFromQuery(
      {types: extractedTypes.concat(givenTypes).join(';')},
      'types',
      this.searchTypesMap
    );

    // Remove 'projects' from q and add to the projects option of the advancedParams
    const projectMatches = q.match(/\bproject:\S*/g);
    const givenProjects = isNullOrUndefined(params.projects) ? [] : params.projects;
    const extractedProjects = projectMatches === null ? [] : projectMatches.map(projectVal => projectVal.split(':')[1]);

    q = q.replace(/\bproject:\S*/g, '');
    advancedParams.projects = extractedProjects.concat(givenProjects);

    // Remove the first phrase from q and add to the phrase option of the advancedParams
    const phraseMatch = q.match(/\"((?:\"\"|[^\"])*)\"/);
    const givenPhrase = isNullOrUndefined(params.phrase) ? '' : params.phrase;

    q = q.replace(/\"((?:\"\"|[^\"])*)\"/, '');
    // If a phrase was given, we should use that in the advanced options. If it wasn't given, but there was a phrase found in q, then use
    // that instead.
    if (givenPhrase !== '') {
      advancedParams.phrase = givenPhrase;
    } else {
      // Group 2 of the match should be the `"` enclosed string, hence the `phraseMatch[1]` here
      advancedParams.phrase = phraseMatch !== null ? phraseMatch[1] : '';
    }

    // Remove 'wildcards' from q and add to the wildcards option of the advancedParams
    const givenWildcards = isNullOrUndefined(params.wildcards) ? [] : [params.wildcards];
    const extractedWildcards = q.match(/\S*(\?|\*)\S*/g);

    q = q.replace(/\S*(\?|\*)\S*/g, '');
    advancedParams.wildcards = givenWildcards.concat(extractedWildcards).join(' ').trim();

    // Do one last whitespace replacement to clean up the query string
    q = q.replace(/\s+/g, ' ').trim();

    advancedParams.q = q;

    return advancedParams;
  }

  /**
   * Opens the advanced search dialog. Users can add special options to their query using this feature.
   */
  openAdvancedSearch() {
    const modalRef = this.modalService.open(AdvancedSearchDialogComponent, {
      size: 'md',
    });
    // Get the starting options from the content search form query, if the user has edited it since loading the page. Otherwise, get them
    // from the URL params.
    modalRef.componentInstance.params = this.extractAdvancedParams(this.contentSearchFormVal);
    modalRef.componentInstance.typeChoices = this.searchTypes.concat().sort((a, b) => a.name.localeCompare(b.name));
    modalRef.result
      // Advanced search was triggered
      .then((params) => {
        this.advancedSearch(params);
      })
      // Advanced search dialog was dismissed or rejected
      .catch(() => {});
  }

  itemDragStart(event: DragEvent, object: FilesystemObject, force = false) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    if (force || !dataTransfer.types.includes('text/uri-list')) {
      object.addDataTransferData(dataTransfer);
    }
  }
}
