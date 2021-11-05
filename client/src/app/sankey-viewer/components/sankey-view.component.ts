import { Component, EventEmitter, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, Subscription, BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { map, delay, catchError } from 'rxjs/operators';
import { isNull, compact } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { SessionStorageService } from 'app/shared/services/session-storage.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { tokenizeQuery, FindOptions, compileFind } from 'app/shared/utils/find';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { MimeTypes } from 'app/shared/constants';
import { SelectionManyToManyEntity } from 'app/sankey-many-to-many-viewer/components/interfaces';
import { SankeyOptions, SankeyState, SelectionType, SelectionEntity, SankeyURLLoadParam } from 'app/shared-sankey/interfaces';

import { CustomisedSankeyLayoutService } from '../services/customised-sankey-layout.service';
import { SankeyLayoutService } from './sankey/sankey-layout.service';
import { isNodeMatching, isLinkMatching } from './search-match';
import { SankeyControllerService } from '../services/sankey-controller.service';
import { PathReportComponent } from './path-report/path-report.component';


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
    readonly modalService: NgbModal,
    readonly snackBar: MatSnackBar,
    protected readonly workSpaceManager: WorkspaceManager,
    readonly router: Router,
    readonly sessionStorage: SessionStorageService,
    readonly filesystemObjectActions: FilesystemObjectActions,
    readonly sankeyController: SankeyControllerService
  ) {
    this.initSelection();

    this.loadTask = new BackgroundTask(hashId => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        ) as Observable<GraphFile>
      );
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {
      this.sankeyController.load(content, () => {
        this.sankeyController.state.networkTraceIdx = this.preselectedNetworkTraceIdx || 0;
      });
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
    return this.sankeyController.options as SankeyOptions;
  }

  get state() {
    return this.sankeyController.state as SankeyState;
  }

  get dataToRender() {
    return this.sankeyController.dataToRender;
  }

  get nodeAlign() {
    return this.sankeyController.state.nodeAlign;
  }

  get networkTraces() {
    return this.sankeyController.options.networkTraces;
  }

  get selectedNetworkTrace() {
    return this.sankeyController.selectedNetworkTrace;
  }


  get predefinedValueAccessor() {
    return this.sankeyController.predefinedValueAccessor;
  }

  paramsSubscription: Subscription;
  returnUrl: string;
  selection: BehaviorSubject<Array<SelectionManyToManyEntity>>;
  selectionWithTraces;
  loadTask: BackgroundTask<string, [FilesystemObject, GraphFile]>;
  openSankeySub: Subscription;
  ready = false;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  detailsPanel = false;
  advancedPanel = false;
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

  private preselectedNetworkTraceIdx;
  activeViewName: string;

  initSelection() {
    this.selection = new BehaviorSubject([]);
    this.selectionWithTraces = this.selection.pipe(
      map((currentSelection) => {
        const nodes = compact(currentSelection.map(e => e[SelectionType.node]));
        const links = compact(currentSelection.map(e => e[SelectionType.link]));
        const traces = [
          ...this.sankeyController.getRelatedTraces({nodes, links})
        ].map(trace => ({[SelectionType.trace]: trace} as SelectionEntity));
        return [...currentSelection].reverse().concat(traces);
      })
    );
    this.selectedNodes = this.selection.pipe(map(currentSelection => {
      return new Set(compact(currentSelection.map(e => e[SelectionType.node])));
    }));
    this.selectedLinks = this.selection.pipe(map(currentSelection => {
      return new Set(compact(currentSelection.map(e => e[SelectionType.link])));
    }));
    this.selection.subscribe(selection => this.detailsPanel = !!selection.length);
  }

  saveFile() {
    const contentValue = new Blob(
      [JSON.stringify(
        this.sankeyController.allData
      )],
      {type: MimeTypes.Graph});
    this.filesystemService.save(
      [this.object.hashId],
      {contentValue}
    )
      .pipe(
        delay(1000),
        catchError((err) => {
          console.log(err);
          this.snackBar.open('Error saving file.', null, {
            duration: 2000,
          });
          return EMPTY;
        })
      ).subscribe(() => {
      this.emitModuleProperties();
      this.snackBar.open('File has been updated.', null, {
        duration: 2000,
      });
    });
  }

  selectNetworkTrace(networkTraceIdx) {
    this.sankeyController.state.networkTraceIdx = networkTraceIdx;
    this.sankeyController.setPredefinedValueAccessor();
    this.sankeyController.applyState();
    this.resetSelection();
  }

  open(content) {
    const modalRef = this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    });
    modalRef.result
      .then(_ => _, _ => _);
    return modalRef;
  }

  parseUrlFragment(fragment: string) {
    const params = new URLSearchParams(fragment);
    this.preselectedNetworkTraceIdx = parseInt(params.get(SankeyURLLoadParam.NETWORK_TRACE_IDX), 10) || 0;
    this.activeViewName = params.get(SankeyURLLoadParam.VIEW_NAME);
  }

  openPathReport() {
    const modalRef = this.open(PathReportComponent);
    modalRef.componentInstance.pathReport = this.sankeyController.getPathReports();
  }

  resetView() {
    this.sankeyController.resetController();
    this.sankey.resetZoom();
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

    this.loadTask.update(hashId);
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

    // Check if the component was loaded with additional params
    const fragment = this.route.snapshot.fragment;
    if (!isNull(fragment)) {
      this.parseUrlFragment(fragment);
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
  toggleSelect(entity, type: SelectionType) {
    const currentSelection = this.selection.value;
    const idxOfSelectedLink = currentSelection.findIndex(
      d => d[type] === entity
    );

    if (idxOfSelectedLink !== -1) {
      currentSelection.splice(idxOfSelectedLink, 1);
    } else {
      currentSelection.push({
        [type]: entity
      } as SelectionEntity);
    }

    this.selection.next(currentSelection);
  }

  selectNode(node) {
    this.toggleSelect(node, SelectionType.node);
  }

  selectLink(link) {
    this.toggleSelect(link, SelectionType.link);
  }

  resetSelection() {
    this.selection.next([]);
  }

  // endregion

  selectPredefinedValueAccessor(predefinedValueAccessorId) {
    this.sankeyController.state.predefinedValueAccessorId = predefinedValueAccessorId;
    this.sankeyController.predefinedValueAccessor.callback();
    this.sankeyController.applyState();
  }

  // region Search
  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options additional find options
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
    // @ts-ignore
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
