import {
  Component,
  EventEmitter,
  OnDestroy,
  ViewChild,
  AfterContentInit,
  ComponentFactoryResolver,
  Injector,
  AfterViewInit
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { tap, switchMap, catchError, map, delay, first } from 'rxjs/operators';
import { Subscription, BehaviorSubject, Observable, of, ReplaySubject, combineLatest, EMPTY } from 'rxjs';
import { isNil, pick, compact } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { SelectionSingleLaneEntity } from 'app/sankey/base-views/single-lane/components/interfaces';
import { SankeyState, SelectionType, SelectionEntity, SankeyURLLoadParam, ViewBase, SankeyOptions } from 'app/sankey/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { mapBufferToJson, mapBlobToBuffer } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { FindOptions, tokenizeQuery } from 'app/shared/utils/find';

import { SankeySearchService } from '../services/search.service';
import Sankey from '../base-views/multi-lane/resolve';
import SankeySingleLane from '../base-views/single-lane/resolve';
import { SankeyControllerService } from '../services/sankey-controller.service';
import { PathReportComponent } from './path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from '../directives/advanced-panel.directive';
import { SankeyDetailsPanelDirective } from '../directives/details-panel.directive';
import { SankeyDirective } from '../directives/sankey.directive';
import { SankeyBaseViewControllerService } from '../services/sankey-base-view-controller.service';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
  providers: [
    WarningControllerService,
    SankeySearchService
  ]
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent, AfterContentInit, AfterViewInit {
  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    readonly modalService: NgbModal,
    readonly snackBar: MatSnackBar,
    protected readonly workSpaceManager: WorkspaceManager,
    readonly router: Router,
    readonly filesystemObjectActions: FilesystemObjectActions,
    readonly warningController: WarningControllerService,
    readonly sankeySearch: SankeySearchService,
    readonly viewService: ViewService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private sankeyController: SankeyControllerService,
    private injector: Injector
  ) {
    const createSankeyInjector = providers => Injector.create({
      providers: [
        ...providers,
        {
          provide: WarningControllerService,
          useValue: warningController
        }
      ],
      parent: injector
    });
    this.baseViewInjectors.set(Sankey, createSankeyInjector(Sankey.providers));
    this.baseViewInjectors.set(SankeySingleLane, createSankeyInjector(SankeySingleLane.providers));

    this.route.fragment.pipe(
      tap(x => console.log('route.fragment', x)),
      switchMap(fragment =>
        // pipe on this.parseUrlFragmentToState, so it does only kill its observable upon error
        // (do not kill route observable)
        this.parseUrlFragmentToState(fragment).pipe(
          catchError((err, o) => {
            this.snackBar.open('Referenced view could not be found.', null, {duration: 2000});
            // return empty observable so does not continue with that one
            return EMPTY;
          })
        )
      ),
      // set base view from content if not given in url
      switchMap((state: SankeyState) => state.baseViewName ? of(state) :
        this.content.pipe(
          map(content => {
            state.baseViewName = SankeyViewComponent.getDefaultViewBase(content, state.networkTraceIdx ?? 0);
            return state;
          })
        )
      ),
    ).pipe(
      tap(x => console.log('route.fragment', x)),
    ).subscribe(state => {
    });

    this.loadTask = new BackgroundTask(hashId =>
      combineLatest([
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          tap(x => console.log('getContent', x)),
          mapBlobToBuffer(),
          mapBufferToJson()
        ) as Observable<GraphFile>
      ])
    );

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    combineLatest([this.sankeyController.data$, this.baseViewName$]).subscribe(([content, baseView]) => {
      this.sankeyController.load(content);
    });


    // Listener for file open
    this.openSankeySub = this.loadTask.results$.subscribe(({
                                                             result: [object, content],
                                                           }) => {
      if (this.sanityChecks(content)) {
        this.content.next(content);
      }
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.route.params.subscribe(({file_id}: { file_id: string }) => {
      this.object = null;
      this.currentFileId = null;
      this.openSankey(file_id);
    });


    this.route.fragment.subscribe(x => console.log('fragment', x));
    this.baseViewName$.subscribe(x => console.log('baseViewName', x));
    this.content.subscribe(x => console.log('content', x));
  }

  get warnings() {
    return this.warningController.warnings;
  }

  get options() {
    return this.sankeyController.options$ as Observable<SankeyOptions>;
  }

  get state() {
    return this.sankeyController?.state$ as Observable<SankeyState>;
  }

  get nodeAlign() {
    return this.sankeyController.state$.pipe(map(({nodeAlign}) => nodeAlign));
  }

  get selectedNetworkTrace() {
    return this.sankeyController.networkTrace$;
  }

  get predefinedValueAccessor() {
    return this.sankeyController.predefinedValueAccessor$;
  }

  get searching() {
    return !this.sankeySearch.done;
  }

  get viewParams() {
    return this.sankeyController.state$.pipe(
      map(state =>
        pick(
          state,
          [
            'networkTraceIdx',
            'viewBase',
            'viewName'
          ]
        )
      )
    ).toPromise();
  }

  get entitySearchListIdx() {
    return this._entitySearchListIdx;
  }

  sankeyBaseViewControl: SankeyBaseViewControllerService;

  set entitySearchListIdx(idx) {
    this._entitySearchListIdx = idx;
    const {networkTraceIdx} = this.entitySearchList.value[idx] ?? {};
    this.sankeyController.state$.pipe(
      first(),
    ).subscribe(
      state => {
        if (!isNil(networkTraceIdx) && state.networkTraceIdx !== networkTraceIdx) {
          this.selectNetworkTrace(networkTraceIdx);
        } else {
          this.setSearchFocus(idx);
        }
      }
    );
  }

  baseViewName$ = this.sankeyController.state$.pipe(
    map(({baseViewName}) => baseViewName)
  );
  dynamicContainer;
  _dynamicInstances = new Map();

  @ViewChild(SankeyDirective, {static: true}) sankey;
  @ViewChild(SankeyDetailsPanelDirective, {static: true}) details;
  @ViewChild(SankeyAdvancedPanelDirective, {static: true}) advanced;
  baseViewInjectors = new WeakMap();

  content = new ReplaySubject(1);

  dataToRender$;
  allData$;

  searchTerms = [];

  paramsSubscription: Subscription;
  returnUrl: string;
  selection: BehaviorSubject<Array<SelectionSingleLaneEntity>>;
  selectionWithTraces;
  loadTask: BackgroundTask<string, [FilesystemObject, GraphFile]>;
  openSankeySub: Subscription;
  ready = false;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  detailsPanel = false;
  searchPanel = false;
  advancedPanel = false;
  selectedNodes;
  selectedLinks;
  selectedTraces;
  object: FilesystemObject;
  currentFileId;

  isArray = Array.isArray;

  entitySearchTerm = '';
  entitySearchList = new BehaviorSubject([]);
  _entitySearchListIdx = -1;

  searchFocus = undefined;

  predefinedState: Observable<Partial<SankeyState>>;

  networkTraces$ = this.sankeyController.options$.pipe(map(({networkTraces}) => networkTraces));

  static getDefaultViewBase(content, networkTraceIdx): ViewBase {
    const {graph: {node_sets, trace_networks}} = content;
    const networkTrace = trace_networks[networkTraceIdx];
    const _inNodes = node_sets[networkTrace.sources];
    const _outNodes = node_sets[networkTrace.targets];
    return (_inNodes.length > 1 && _outNodes.length > 1) ? ViewBase.sankeySingleLane : ViewBase.sankeyMultiLane;
  }


  ngAfterViewInit() {
    this.baseViewName$.subscribe(baseView => {
      console.log('baseViewName', baseView);
      const o = baseView === ViewBase.sankeyMultiLane ? Sankey : SankeySingleLane;
      const sankeyInjector = this.baseViewInjectors.get(o);
      const injectComponent = (container, component) => {
        const factory = this.componentFactoryResolver.resolveComponentFactory(component);
        const componentRef = container.createComponent(factory, null, sankeyInjector);
        return componentRef.instance;
      };
      const createComponent = name => this._dynamicInstances.set(name, injectComponent(this[name].viewContainerRef, o[name]));
      createComponent('sankey');
      createComponent('advanced');
      createComponent('details');
      this.sankeyBaseViewControl = sankeyInjector.get(SankeyBaseViewControllerService);
      this.dataToRender$ = this.sankeyController.dataToRender$;
      this.allData$ = this.sankeyController.data$;
    });
  }

  sanityChecks({graph: {trace_networks}, nodes, links}: GraphFile) {
    let pass = true;
    if (!trace_networks.length) {
      this.warningController.warn('File does not contain any network traces', false);
      pass = false;
    }
    if (!nodes.length) {
      this.warningController.warn('File does not contain any nodes', false);
      pass = false;
    }
    if (!links.length) {
      this.warningController.warn('File does not contain any links', false);
      pass = false;
    }
    return pass;
  }

  ngAfterContentInit() {
  }


  initSelection() {
    this.selection = new BehaviorSubject([]);
    this.selectionWithTraces = this.selection.pipe(
      tap(x => console.log('selection', x)),
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
    return this.sankeyController.data$.pipe(
      switchMap(data => {
        const contentValue = new Blob(
          [JSON.stringify(data)],
          {type: MimeTypes.Graph});
        return this.filesystemService.save(
          [this.object.hashId],
          {contentValue}
        )
          .pipe(
            delay(1000),
            tap(() => {
              this.emitModuleProperties();
              this.snackBar.open('File has been updated.', null, {
                duration: 2000,
              });
            }),
            catchError(() => {
              this.snackBar.open('Error saving file.', null, {
                duration: 2000,
              });
              return EMPTY;
            })
          );
      })
    ).toPromise();
  }

  async selectNetworkTrace(networkTraceIdx) {
    await this.sankeyController.selectNetworkTrace(networkTraceIdx).toPromise();

    this.resetSelection();
    if (this.entitySearchTerm) {
      this.search();
    }
  }

  open(content) {
    const modalRef = this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    });
    modalRef.result
      .then(_ => _, _ => _);
    return modalRef;
  }

  parseUrlFragmentToState(fragment: string): Observable<Partial<SankeyState>> {
    const state = {} as Partial<SankeyState>;
    const params = new URLSearchParams(fragment ?? '');
    for (const [param, value] of (params as any).entries()) {
      switch (param) {
        case SankeyURLLoadParam.NETWORK_TRACE_IDX:
          state.networkTraceIdx = parseInt(value, 10) || 0;
          break;
        case SankeyURLLoadParam.VIEW_NAME:
          state.viewName = value;
          break;
        case SankeyURLLoadParam.BASE_VIEW_NAME:
          state.baseViewName = value;
          break;
        default:
          return this.viewService.get(param).pipe(
            tap(view => Object.assign(view, state))
          );
      }
    }
    return of(state);
  }

  openPathReport() {
    const modalRef = this.open(PathReportComponent);
    this.sankeyController.pathReports$.subscribe(pathReports => {
      modalRef.componentInstance.pathReports = pathReports;
    });
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
    // this.resetSelection();
  }

  closeSearchPanel() {
    this.searchPanel = false;
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

  loadFromUrl({file_id}) {
    if (file_id) {
      this.object = null;
      this.currentFileId = null;
      this.openSankey(file_id);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.openSankey(this.currentFileId);
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
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
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
    this.sankeyController.selectPredefinedValueAccessor(predefinedValueAccessorId);
  }

  // region Search
  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options additional find options
   */
  findMatching(terms: string[], options: FindOptions = {}) {
    this.sankeySearch.stopSearch();
    this.sankeySearch.clear();
    combineLatest([this.sankeyController.data$, this.sankeyController.dataToRender$]).pipe(
      first()
    ).subscribe(([data, dataToRender]) => {
      this.sankeySearch.update({
        terms,
        options,
        data,
        dataToSearch: dataToRender
      });
      this.sankeySearch.search();
    });
  }

  search() {
    this.searchTerms = tokenizeQuery(
      this.entitySearchTerm,
      {singleTerm: true}
    );
    this.entitySearchListIdx = -1;
    if (this.entitySearchTerm.length) {
      this.searchPanel = true;
      this.findMatching(
        this.searchTerms,
        {wholeWord: false}
      );
    } else {
      this.searchPanel = false;
      this.entitySearchList.next([]);
    }
  }

  clearSearchQuery() {
    this.searchPanel = false;
    this.entitySearchTerm = '';
    this.search();
  }

  panToEntity(entity) {
    entity.subscribe(e => {
      if (e) {
        this.sankey.sankeySelection.transition().call(
          this.sankey.zoom.translateTo,
          // x
          (e._x0 !== undefined) ?
            (e._x0 + e._x1) / 2 :
            (e._source._x1 + e._target._x0) / 2,
          // y
          (e._y0 + e._y1) / 2
        );
      }
    });
  }


  resolveMatchToEntity({nodeId, linkId}) {
    return this.sankeyController.dataToRender$.pipe(
      first(),
      map(({nodes, links}) => {
        if (!isNil(nodeId)) {
          // allow string == number match interpolation ("58" == 58 -> true)
          // tslint:disable-next-line:triple-equals
          return nodes.find(({_id}) => _id == nodeId);
        }
        if (!isNil(linkId)) {
          // allow string == number match interpolation ("58" == 58 -> true)
          // tslint:disable-next-line:triple-equals
          return links.find(({_id}) => _id == linkId);
        }
      })
    );
  }

  setSearchFocus(idx) {
    const searchEntity = this.entitySearchList.value[idx];
    if (searchEntity) {
      this.searchFocus = searchEntity;
      this.panToEntity(this.resolveMatchToEntity(this.searchFocus));
    } else {
      this.searchFocus = undefined;
    }
  }

  next() {
    if (this.entitySearchListIdx >= this.entitySearchList.value.length - 1) {
      this.entitySearchListIdx = 0;
    } else {
      this.entitySearchListIdx++;
    }
  }

  previous() {
    // we need rule ..
    if (this.entitySearchListIdx <= 0) {
      this.entitySearchListIdx = this.entitySearchList.value.length - 1;
    } else {
      this.entitySearchListIdx--;
    }
  }

  // endregion
}
