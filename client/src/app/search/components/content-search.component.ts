import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import { getObjectCommands } from 'app/file-browser/utils/objects';
import { DirectoryObject } from 'app/interfaces/projects.interface';

import { ProjectSpaceService } from 'app/file-browser/services/project-space.service';
import { PDFResult, PDFSnippets } from 'app/interfaces';
import { RankedItem } from 'app/interfaces/shared.interface';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleProperties } from 'app/shared/modules';
import { CollectionModal } from 'app/shared/utils/collection-modal';
import {
  deserializePaginatedParams,
  getChoicesFromQuery,
  serializePaginatedParams
} from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { ContentSearchOptions, TYPES, TYPES_MAP } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
})
export class ContentSearchComponent extends PaginatedResultListComponent<ContentSearchOptions,
    RankedItem<DirectoryObject>> implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  private readonly defaultLimit = 20;
  public results = new CollectionModal<RankedItem<DirectoryObject>>([], {
    multipleSelection: false,
  });
  fileResults: PDFResult = {hits: [{} as PDFSnippets], maxScore: 0, total: 0};

  constructor(route: ActivatedRoute,
              workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService,
              protected readonly projectSpaceService: ProjectSpaceService,
              protected readonly sanitizer: DomSanitizer) {
    super(route, workspaceManager);
  }

  get valid(): boolean {
    return !!this.params.q.length;
  }

  valueChanged(value: ContentSearchOptions) {
    this.modulePropertiesChange.emit({
      title: value.q.length ? `Search: ${value.q}` : 'Search',
      fontAwesomeIcon: 'search',
    });
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
}
