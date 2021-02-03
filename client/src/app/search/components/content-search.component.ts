import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { isNullOrUndefined } from 'util';

import { HighlightDisplayLimitChange } from 'app/file-browser/components/file-info.component';
import { FileViewComponent } from 'app/file-browser/components/file-view.component';
import { getObjectCommands, getObjectMatchExistingTab } from 'app/file-browser/utils/objects';
import { PDFResult, PDFSnippets } from 'app/interfaces';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { PaginatedResultListComponent } from 'app/shared/components/base/paginated-result-list.component';
import { ModuleProperties } from 'app/shared/modules';
import { RankedItem } from 'app/shared/schemas/common';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CollectionModal } from 'app/shared/utils/collection-modal';
import { FindOptions } from 'app/shared/utils/find';
import { deserializePaginatedParams, getChoicesFromQuery, serializePaginatedParams } from 'app/shared/utils/params';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { ContentSearchOptions, TYPES_MAP } from '../content-search';
import { ContentSearchService } from '../services/content-search.service';
import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';

@Component({
  selector: 'app-content-search',
  templateUrl: './content-search.component.html',
  styleUrls: ['./content-search.component.scss']
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
  highlightOptions: FindOptions = {keepSearchSpecialChars: true};

  get emptyParams(): boolean {
    if (isNullOrUndefined(this.params)) {
      return true;
    }
    const qExists = this.params.hasOwnProperty('q') && this.params.q.length !== 0;
    const typesExists = this.params.hasOwnProperty('types') && this.params.types.length !== 0;
    const projectsExists = this.params.hasOwnProperty('projects') && this.params.projects.length !== 0;

    return !(qExists || typesExists || projectsExists);
  }

  constructor(private modalService: NgbModal,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly contentSearchService: ContentSearchService,
              protected readonly zone: NgZone,
              protected readonly messageDialog: MessageDialog) {
    super(route, workspaceManager);
  }

  valueChanged(value: ContentSearchOptions) {
    this.modulePropertiesChange.emit({
      title: value.q.length ? `Search: ${value.q}` : 'Search',
      fontAwesomeIcon: 'search',
    });
  }

  getResults(params: ContentSearchOptions) {
    return this.contentSearchService.search(this.serializeParams(params));
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
      advancedParams.types = getChoicesFromQuery(params, 'types', TYPES_MAP);
    }
    if (params.hasOwnProperty('projects')) {
      advancedParams.projects = params.projects === '' ? [] : params.projects.split(';');
    }
    return advancedParams;
  }

  deserializeParams(params) {
    return {
      ...deserializePaginatedParams(params, this.defaultLimit),
      ...this.deserializeAdvancedParams(params),
      q: isNullOrUndefined(params.q) ? '' : params.q,
    };
  }

  serializeAdvancedParams(params) {
    const advancedParams: any = {};

    if (params.hasOwnProperty('types')) {
      advancedParams.types = params.types.map(value => value.id).join(';');
    }
    if (params.hasOwnProperty('projects')) {
      advancedParams.projects = params.projects.join(';');
    }
    return advancedParams;
  }

  serializeParams(params, restartPagination = false) {
    return {
      ...serializePaginatedParams(params, restartPagination),
      ...this.serializeAdvancedParams(params),
      q: isNullOrUndefined(params.q) ? '' : params.q,
    };
  }

  search(params) {
    this.workspaceManager.navigate(this.route.snapshot.url.map(item => item.path), {
      queryParams: {
        ...this.serializeParams({
          ...this.getDefaultParams(),
          // If normal search, only use the 'q' param; Ignore any advanced params we arrived at the page with
          q: isNullOrUndefined(params.q) ? '' : params.q,
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

  /**
   * Attempts to extract advanced search options from the query string paramter 'q'. If any advanced options are found, they are removed
   * 'q' and added to the params object.
   * @param params object representing the url query string params
   */
  extractAdvancedParams(params) {
    const advancedParams: any = {};
    let q = '';

    if (params.hasOwnProperty('q')) {
      q = (params.q as string);
      advancedParams.types = params.hasOwnProperty('types') ? params.types : [];
      advancedParams.projects = params.hasOwnProperty('projects') ? params.projects : [];
    }

    advancedParams.q = q;

    return advancedParams;
  }

  /**
   * Openns the advanced search dialog. Users can add special options to their query using this feature.
   */
  openAdvancedSearch() {
    const modalRef = this.modalService.open(AdvancedSearchDialogComponent, {
      size: 'md',
    });
    modalRef.componentInstance.params = this.extractAdvancedParams(this.params);
    modalRef.result
      // Advanced search was triggered
      .then((params) => {
        this.advancedSearch(params);
      })
      // Advanced search dialog was dismissed or rejected
      .catch(() => {});
  }
}
