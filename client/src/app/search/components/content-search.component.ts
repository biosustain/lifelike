import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { getObjectCommands, getObjectMatchExistingTab } from 'app/file-browser/utils/objects';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { PDFResult, PDFSnippets } from 'app/interfaces';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleProperties } from 'app/shared/modules';
import { CollectionModel } from 'app/shared/utils/collection-model';
import {
  deserializePaginatedParams,
  getChoicesFromQuery,
  serializePaginatedParams,
} from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { ContentSearchOptions, TYPES_MAP } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { HighlightDisplayLimitChange } from '../../file-browser/components/object-info.component';
import { FileViewComponent } from '../../pdf-viewer/components/file-view.component';
import { RankedItem, ResultList } from '../../shared/schemas/common';
import { map } from 'rxjs/operators';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Observable } from 'rxjs';
import { ContentSearchRequest } from '../schema';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
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

  constructor(protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService,
              protected readonly zone: NgZone) {
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

  getResults(params: ContentSearchOptions): Observable<ResultList<RankedItem<FilesystemObject>>> {
    const request: ContentSearchRequest = {
      sort: params.sort,
      page: params.page,
      limit: params.limit,
      q: params.q,
    };

    // If we don't provide a list of mime types, then the server will return all
    // by default
    if (params.mimeTypes.length) {
      request.mimeTypes = params.mimeTypes.map(item => item.id);
    }

    return this.contentSearchService.search(request).pipe(
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
      mimeTypes: [],
      q: '',
    };
  }

  deserializeParams(params) {
    return {
      ...deserializePaginatedParams(params, this.defaultLimit),
      q: params.hasOwnProperty('q') ? params.q : '',
      mimeTypes: params.hasOwnProperty('mimeTypes') ? getChoicesFromQuery(params, 'mimeTypes', TYPES_MAP) : [],
    };
  }

  serializeParams(params, restartPagination = false) {
    return {
      ...serializePaginatedParams(params, restartPagination),
      q: params.q,
      mimeTypes: params.mimeTypes.map(value => value.id).join(';'),
    };
  }

  getObjectCommands(object: DirectoryObject) {
    return getObjectCommands(object);
  }

  highlightClicked(object: DirectoryObject, highlight: string) {
    const parser = new DOMParser();
    const text = parser.parseFromString(highlight, 'application/xml').documentElement.textContent;
    const commands = this.getObjectCommands(object);
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
}
