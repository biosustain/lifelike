import { Component, OnDestroy, OnInit } from '@angular/core';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { ContentSearchOptions, TYPES, TYPES_MAP } from '../content-search';
import { ActivatedRoute } from '@angular/router';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { deserializePaginatedParams, getChoicesFromQuery, serializePaginatedParams } from '../../shared/utils/params';
import { PaginatedResultListComponent } from '../../shared/components/base/paginated-result-list.component';
import { ContentSearchService } from '../services/content-search.service';
import { RankedItem } from '../../interfaces/shared.interface';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
})
export class ContentSearchComponent extends PaginatedResultListComponent<ContentSearchOptions,
  RankedItem<DirectoryObject>> implements OnInit, OnDestroy {
  private readonly defaultLimit = 100;

  constructor(route: ActivatedRoute,
              workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService) {
    super(route, workspaceManager);
  }

  get valid(): boolean {
    return !!this.params.q.length;
  }

  getResults(params: ContentSearchOptions) {
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
      types: params.hasOwnProperty('type') ? getChoicesFromQuery(params, 'type', TYPES_MAP) : [...TYPES],
    };
  }

  serializeParams(params, restartPagination = false) {
    return {
      ...serializePaginatedParams(params, restartPagination),
      q: params.q,
      types: params.types.map(value => value.id).join(';'),
    };
  }
}
