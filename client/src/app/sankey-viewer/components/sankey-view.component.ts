import { Component, EventEmitter, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { combineLatest, Subscription, BehaviorSubject } from 'rxjs';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { map } from 'rxjs/operators';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';


import { WorkspaceManager } from 'app/shared/workspace-manager';
import { SessionStorageService } from 'app/shared/services/session-storage.service';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { CustomisedSankeyLayoutService } from '../services/customised-sankey-layout.service';
import { SankeyLayoutService } from './sankey/sankey-layout.service';
import { tokenizeQuery, FindOptions, compileFind } from '../../shared/utils/find';
import { isNodeMatching, isLinkMatching } from './search-match';
import { SankeyControllerService } from '../services/sankey-controller.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { SelectionEntity } from './interfaces';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
  providers: [
    CustomisedSankeyLayoutService, {
      provide: SankeyLayoutService,
      useExisting: CustomisedSankeyLayoutService
    },
    SankeyControllerService
  ]
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent {

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    private modalService: NgbModal,
    protected readonly workSpaceManager: WorkspaceManager,
    private router: Router,
    private sessionStorage: SessionStorageService,
    private readonly filesystemObjectActions: FilesystemObjectActions,
    private sankeyController: SankeyControllerService
  ) {
    this.selection = new BehaviorSubject([]);
    this.selectionWithTraces = this.selection.pipe(
      map((currentSelection) => {
        const nodes = currentSelection.filter(({type}) => type === 'node').map(({entity}) => entity);
        const links = currentSelection.filter(({type}) => type === 'link').map(({entity}) => entity);
        const traces = [
          ...this.sankeyController.getRelatedTraces({nodes, links})
        ].map(entity => ({
          type: 'trace',
          entity
        } as SelectionEntity));
        return [...currentSelection].reverse().concat(traces);
      })
    );
    this.selectedNodes = this.selection.pipe(map(currentSelection => {
      return new Set(currentSelection.filter(({type}) => type === 'node').map(({entity}) => entity));
    }));
    this.selectedLinks = this.selection.pipe(map(currentSelection => {
      return new Set(currentSelection.filter(({type}) => type === 'link').map(({entity}) => entity));
    }));

    this.loadTask = new BackgroundTask(([hashId]) => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        )
      );
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {
      this.sankeyController.load(content);
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.loadFromUrl();
  }

  get allData() {
    return this.sankeyController.allData;
  }

  get options() {
    return this.sankeyController.options;
  }

  get dataToRender() {
    return this.sankeyController.dataToRender;
  }

  get nodeAlign() {
    return this.sankeyController.nodeAlign;
  }

  get networkTraces() {
    return this.sankeyController.networkTraces;
  }

  get selectedNetworkTrace() {
    return this.sankeyController.selectedNetworkTrace;
  }

  paramsSubscription: Subscription;
  returnUrl: string;
  selection: BehaviorSubject<Array<{
    type: string,
    entity: SankeyLink | SankeyNode | object
  }>>;
  selectionWithTraces;
  loadTask: BackgroundTask<any, any>;
  openSankeySub: Subscription;
  ready = false;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  detailsPanel: boolean;
  advancedPanel: boolean;
  selectedNodes;
  selectedLinks;
  selectedTraces;
  object: FilesystemObject;
  currentFileId;

  @ViewChild('sankey', {static: false}) sankey;
  isArray = Array.isArray;

  entitySearchTerm = '';
  entitySearchList = new Set();
  entitySearchListIdx = -1;
  searchFocus = undefined;

  selectNetworkTrace(trace) {
    return this.sankeyController.selectNetworkTrace(trace);
  }

  open(content) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    }).result
      .then(_ => _, _ => _);
  }

  // region Zoom
  resetZoom() {
    if (this.sankey) {
      this.sankey.resetZoom();
    }
  }

  zoomIn() {
    if (this.sankey) {
      this.sankey.scaleZoom(1.25);
    }
  }

  zoomOut() {
    if (this.sankey) {
      this.sankey.scaleZoom(.8);
    }
  }

  // endregion

  openDetailsPanel() {
    this.detailsPanel = true;
  }

  closeDetailsPanel() {
    this.detailsPanel = false;
    this.resetSelection();
  }

  closeAdvancedPanel() {
    this.advancedPanel = false;
  }

  /**
   * Open sankey by file_id along with location to scroll to
   * @param hashId - represent the sankey to open
   */
  openSankey(hashId: string) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      return;
    }
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      this.openSankey(linkedFileId);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
    this.openSankeySub.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    });
  }

  openNewWindow() {
    this.filesystemObjectActions.openNewWindow(this.object);
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name),
            'sankey', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    }));
  }

  // region Selection
  toggleSelect(entity, type) {
    const currentSelection = this.selection.value;
    const idxOfSelectedLink = currentSelection.findIndex(
      d => d.type === type && d.entity === entity
    );

    if (idxOfSelectedLink !== -1) {
      currentSelection.splice(idxOfSelectedLink, 1);
    } else {
      currentSelection.push({
        type,
        entity
      });
    }

    this.selection.next(currentSelection);
  }

  selectNode(node) {
    this.toggleSelect(node, 'node');
    this.openDetailsPanel();
  }

  selectLink(link) {
    this.toggleSelect(link, 'link');
    this.openDetailsPanel();
  }

  resetSelection() {
    const data = this.sankeyController.dataToRender.value;
    this.selection.next([]);
    data.nodes.forEach(n => {
      delete n._selected;
    });
    data.links.forEach(l => {
      delete l._selected;
    });
  }
  // endregion

  selectPredefinedValueAccessor(accessor) {
    this.sankeyController.options.selectedPredefinedValueAccessor = accessor;
    accessor.callback();
  }

  // region Search
  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options addiitonal find options
   */
  findMatching(terms: string[], options: FindOptions = {}) {
    const matcher = compileFind(terms, options);
    const matches = new Set();

    const {nodes, links} = this.sankeyController.dataToRender.value;

    for (const node of nodes) {
      if (isNodeMatching(matcher, node)) {
        matches.add(node);
      }
    }

    for (const link of links) {
      if (isLinkMatching(matcher, link, this.sankeyController.allData)) {
        matches.add(link);
      }
    }

    return matches;
  }

  search() {
    if (this.entitySearchTerm.length) {
      this.entitySearchList = this.findMatching(
        tokenizeQuery(this.entitySearchTerm, {
          singleTerm: true,
        }), {
          wholeWord: false,
        });
    } else {
      this.entitySearchList = new Set();
    }
    this.entitySearchListIdx = -1;
    this.searchFocus = undefined;
  }

  clearSearchQuery() {
    this.entitySearchTerm = '';
    this.search();
  }

  panToEntity(entity) {
    this.sankey.sankeySelection.transition().call(
      this.sankey.zoom.translateTo,
      // x
      (entity._x0 !== undefined) ?
        (entity._x0 + entity._x1) / 2 :
        (entity._source._x1 + entity._target._x0) / 2,
      // y
      (entity._y0 + entity._y1) / 2
    );
  }

  setSearchFocus() {
    const searchFocus = [...this.entitySearchList][this.entitySearchListIdx];
    this.searchFocus = searchFocus;
    if (searchFocus) {
      this.panToEntity(searchFocus);
    }
  }

  next() {
    this.entitySearchListIdx++;
    if (this.entitySearchListIdx >= this.entitySearchList.size) {
      this.entitySearchListIdx = 0;
    }
    this.setSearchFocus();
  }

  previous() {
    // we need rule ..
    this.entitySearchListIdx--;
    if (this.entitySearchListIdx <= -1) {
      this.entitySearchListIdx = this.entitySearchList.size - 1;
    }
    this.setSearchFocus();
  }
  // endregion
}
