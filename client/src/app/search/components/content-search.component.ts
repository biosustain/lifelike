import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { flatten } from 'lodash';

import { Observable, of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';

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
import { RankedItem, ResultList, SearchableRequestOptions } from 'app/shared/schemas/common';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { uuidv4 } from 'app/shared/utils';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { FindOptions } from 'app/shared/utils/find';
import {
  deserializePaginatedParams,
  getChoicesFromQuery,
  serializePaginatedParams,
} from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { SynonymSearchComponent } from './synonym-search.component';
import { ContentSearchOptions } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { SearchType } from '../shared';


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
  readonly id = uuidv4(); // Used in the template to prevent duplicate ids across panes

  results = new CollectionModel<RankedItem<FilesystemObject>>([], {
    multipleSelection: false,
  });
  fileResults: PDFResult = {hits: [{} as PDFSnippets], maxScore: 0, total: 0};
  highlightTerms: string[] = [];
  highlightOptions: FindOptions = {keepSearchSpecialChars: true, wholeWord: true};
  searchTypes: SearchType[];
  searchTypesMap: Map<string, SearchType>;

  queryString = '';
  contentSearchFormVal: SearchableRequestOptions;

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

  ngOnInit() {
    super.ngOnInit();

    this.subscriptions.add(this.route.queryParams.pipe(
      mergeMap(params => this.deserializeParams(params))
    ).subscribe(params => {
      this.queryString = this.getQueryStringFromParams(params);
    }));
  }

  valueChanged(value: ContentSearchOptions) {
    this.modulePropertiesChange.emit({
      title: value.q.length ? `Search: ${value.q}` : 'Search',
      fontAwesomeIcon: 'search',
    });
  }

  getResults(params: ContentSearchOptions): Observable<ResultList<RankedItem<FilesystemObject>>> {
    // No point sending a request if the params are completely empty
    if (this.emptyParams) {
      return of({total: 0, results: []});
    }
    return this.contentSearchService.search(this.serializeParams(params)).pipe(
      this.errorHandler.create({label: 'Content search'}),
      tap(response => {
        this.highlightTerms = response.query.phrases;
      })
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

  getQueryStringFromParams(params: ContentSearchOptions) {
    const q = [];
    if (params.hasOwnProperty('q') && params.q !== '') {
      q.push(params.q);
    }
    if (params.hasOwnProperty('wildcards') && params.wildcards !== '') {
      q.push(params.wildcards);
    }
    if (params.hasOwnProperty('phrase') && params.phrase !== '') {
      q.push(`"${params.phrase}"`);
    }
    if (params.hasOwnProperty('types') && params.types !== []) {
      params.types.forEach(type => q.push(`type:${type.shorthand}`));
    }
    if (params.hasOwnProperty('projects') && params.projects !== []) {
      params.projects.forEach(project => q.push(`project:${project}`));
    }

    return q.join(' ');
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

  contentSearchFormChanged(form: SearchableRequestOptions) {
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
  extractAdvancedParams(params: SearchableRequestOptions) {
    const advancedParams: ContentSearchOptions = {};
    let q = isNullOrUndefined(params.q) ? '' : params.q;

    // Remove 'types' from q and add to the types option of the advancedParams
    const typeMatches = q.match(/\btype:\S*/g);
    const extractedTypes = typeMatches == null ? [] : typeMatches.map(typeVal => typeVal.split(':')[1]);
    advancedParams.types = getChoicesFromQuery(
      {types: extractedTypes.join(';')},
      'types',
      this.searchTypesMap
    );
    q = q.replace(/\btype:\S*/g, '');

    // Remove 'projects' from q and add to the projects option of the advancedParams
    const projectMatches = q.match(/\bproject:\S*/g);
    const extractedProjects = projectMatches === null ? [] : projectMatches.map(projectVal => projectVal.split(':')[1]);
    advancedParams.projects = extractedProjects;
    q = q.replace(/\bproject:\S*/g, '');

    // Remove the first phrase from q and add to the phrase option of the advancedParams
    const phraseMatch = q.match(/\"((?:\"\"|[^\"])*)\"/);
    // Group 2 of the match should be the `"` enclosed string, hence the `phraseMatch[1]` here
    advancedParams.phrase = phraseMatch !== null ? phraseMatch[1] : '';
    q = q.replace(/\"((?:\"\"|[^\"])*)\"/, '');

    // Remove 'wildcards' from q and add to the wildcards option of the advancedParams
    const wildcardMatches = q.match(/\S*(\?|\*)\S*/g);
    const extractedWildcards = wildcardMatches === null ? [] : wildcardMatches;
    advancedParams.wildcards = extractedWildcards.join(' ').trim();
    q = q.replace(/\S*(\?|\*)\S*/g, '');

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
    // Get the starting options from the content search form query
    modalRef.componentInstance.params = this.extractAdvancedParams(this.contentSearchFormVal);
    modalRef.componentInstance.typeChoices = this.searchTypes.concat().sort((a, b) => a.name.localeCompare(b.name));
    modalRef.result
      // Advanced search was triggered
      .then((params) => {
        this.advancedSearch(params);
      })
      // Advanced search dialog was dismissed or rejected
      .catch((params) => {
        this.queryString = this.getQueryStringFromParams(params);
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
      .then((synonymsToAdd: string[]) => {
        this.queryString = (synonymsToAdd.join(' ') + (isNullOrUndefined(this.queryString) ? '' : ` ${this.queryString}`)).trim();
      })
      // Synonym search dialog was dismissed or rejected
      .catch(() => {
      });
  }

  itemDragStart(event: DragEvent, object: FilesystemObject, force = false) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    if (force || !dataTransfer.types.includes('text/uri-list')) {
      object.addDataTransferData(dataTransfer);
    }
  }
}
