import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { getObjectCommands } from 'app/file-browser/utils/objects';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { PDFResult, PDFSnippets } from 'app/interfaces';
import { RankedItem } from 'app/interfaces/shared.interface';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleProperties } from 'app/shared/modules';
import { CollectionModal } from 'app/shared/utils/collection-modal';
import { deserializePaginatedParams, getChoicesFromQuery, serializePaginatedParams } from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { ContentSearchOptions, TYPES, TYPES_MAP } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { HighlightDisplayLimitChange } from '../../file-browser/components/file-info.component';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
})
export class ContentSearchComponent extends PaginatedResultListComponent<ContentSearchOptions,
  RankedItem<DirectoryObject>> implements OnInit, OnDestroy {
  @Input() snippetAnnotations = false; // false due to LL-2052 - Remove annotation highlighting
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  private readonly defaultLimit = 20;
  public results = new CollectionModal<RankedItem<DirectoryObject>>([], {
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

  highlightClicked(object: DirectoryObject, highlight: string) {
    const parser = new DOMParser();
    const text = parser.parseFromString(highlight, 'application/xml').documentElement.textContent;
    const commands = this.getObjectCommands(object);
    this.workspaceManager.navigate(commands, {
      fragment: `jump=${encodeURIComponent(text)}`,
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
}
