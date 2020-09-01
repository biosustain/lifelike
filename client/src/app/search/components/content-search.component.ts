import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {DirectoryObject} from '../../interfaces/projects.interface';
import {ContentSearchOptions, TYPES, TYPES_MAP} from '../content-search';
import {ActivatedRoute} from '@angular/router';
import {WorkspaceManager} from '../../shared/workspace-manager';
import {deserializePaginatedParams, getChoicesFromQuery, serializePaginatedParams} from '../../shared/utils/params';
import {PaginatedResultListComponent} from '../../shared/components/base/paginated-result-list.component';
import {ContentSearchService} from '../services/content-search.service';
import {RankedItem} from '../../interfaces/shared.interface';
import {CollectionModal} from '../../shared/utils/collection-modal';
import {getObjectCommands} from 'app/file-browser/utils/objects';
import {ModuleProperties} from '../../shared/modules';
import {PDFResult, PDFSnippets} from '../../interfaces';
import {ProjectSpaceService} from '../../file-browser/services/project-space.service';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
})
export class ContentSearchComponent extends PaginatedResultListComponent<ContentSearchOptions,
    RankedItem<DirectoryObject>> implements OnInit, OnDestroy {
  private readonly defaultLimit = 100;
  public results = new CollectionModal<RankedItem<DirectoryObject>>([], {
    multipleSelection: false,
  });
  fileResults: PDFResult = {hits: [{} as PDFSnippets], maxScore: 0, total: 0};
  snippetFilter: boolean;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  constructor(route: ActivatedRoute,
              workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService,
              protected readonly projectSpaceService: ProjectSpaceService) {
    super(route, workspaceManager);
  }

  get valid(): boolean {
    return !!this.params.q.length;
  }

  valueChanged(value: ContentSearchOptions) {
    this.modulePropertiesChange.emit({
      title: value.q.length ? `Files: ${value.q}` : 'File Search',
      fontAwesomeIcon: 'search',
    });
  }

  getResults(params: ContentSearchOptions) {
    this.snippetFilter = !!params.types.find(filter => filter.id === 'snippets');
    return this.contentSearchService.search(params);
  }

  getDefaultParams() {
    return {
      limit: this.defaultLimit,
      page: 1,
      sort: '+name',
      types: [...TYPES],
      q: '',
    };
  }

  deserializeParams(params) {
    return {
      ...deserializePaginatedParams(params, this.defaultLimit),
      q: params.hasOwnProperty('q') ? params.q : '',
      types: params.hasOwnProperty('types') ? getChoicesFromQuery(params, 'types', TYPES_MAP) : [...TYPES],
    };
  }

  serializeParams(params, restartPagination = false) {
    return {
      ...serializePaginatedParams(params, restartPagination),
      q: params.q,
      types: params.types.map(value => value.id).join(';'),
    };
  }

  getObjectCommands(object: DirectoryObject) {
    return getObjectCommands(object);
  }

  getSnippetResults(params) {
    this.contentSearchService.snippetSearch(params.q)
      .subscribe(results => {
        results.hits.forEach((snippetResult, index) => {
          this.projectSpaceService.getCollaborators(snippetResult.project_directory)
            .subscribe(result => {
            }, error => {
              results.hits.splice(index, 1);
              results.total = results.hits.length;
            });
        });
        this.fileResults = results as PDFResult;
      });
  }
}
