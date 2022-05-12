import {
  Component,
  EventEmitter,
  OnDestroy,
  ViewChild,
  ComponentFactoryResolver,
  Injector,
  AfterViewInit,
  getModuleFactory,
  NgZone,
  OnInit
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { KeyValue } from '@angular/common';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { tap, switchMap, catchError, map, delay, first, startWith, shareReplay } from 'rxjs/operators';
import { Subscription, BehaviorSubject, Observable, of, ReplaySubject, combineLatest, EMPTY, iif, defer, Subject } from 'rxjs';
import { isNil, pick, flatMap, zip } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { SankeyState, ViewBase } from 'app/sankey/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { mapBufferToJson, mapBlobToBuffer } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { isNotEmpty } from 'app/shared/utils';
import { debug } from 'app/shared/rxjs/debug';
import { ExtendedMap } from 'app/shared/utils/types';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { SankeySearchService } from '../services/search.service';
import { PathReportComponent } from './path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from '../directives/advanced-panel.directive';
import { SankeyDetailsPanelDirective } from '../directives/details-panel.directive';
import { SankeyDirective } from '../directives/sankey.directive';
import { ControllerService } from '../services/controller.service';
import { BaseControllerService, DefaultBaseControllerService } from '../services/base-controller.service';
import { MultiLaneBaseModule } from '../base-views/multi-lane/sankey-viewer-lib.module';
import { SingleLaneBaseModule } from '../base-views/single-lane/sankey-viewer-lib.module';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from '../constants/DI';
import { DefaultLayoutService } from '../services/layout.service';
import { ViewControllerService } from '../services/view-controller.service';
import { SankeySelectionService } from '../services/selection.service';
import { ErrorMessages } from '../constants/error';
import { SankeyURLLoadParam } from '../interfaces/url';
import { SankeyUpdateService } from '../services/sankey-update.service';
import { SankeyViewCreateComponent } from './view/create/view-create.component';
import { SankeyConfirmComponent } from './confirm.component';
import { viewBaseToNameMapping } from '../constants/view-base';
import { SankeyDocument, TraceNetwork, View } from '../model/sankey-document';

interface BaseViewContext {
  baseView: DefaultBaseControllerService;
  layout: DefaultLayoutService;
  selection: SankeySelectionService;
}

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
  providers: [
    WarningControllerService,
    SankeySearchService,
    ControllerService,
    ViewControllerService,
    SankeyUpdateService
  ]
})
export class SankeyViewComponent implements OnInit, ModuleAwareComponent, AfterViewInit, OnDestroy {
  fileContent: GraphFile;

  get viewParams() {
    return this.sankeyController.state$.pipe(
      first(),
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

  get sankey() {
    return this.dynamicComponentRef.get('sankey').instance;
  }

  get details() {
    return this.dynamicComponentRef.get('details').instance;
  }

  get advanced() {
    return this.dynamicComponentRef.get('advanced').instance;
  }

  readonlyView$ = this.sankeyController.view$.pipe(
    tap(v => console.log('view', v))
  );

  baseViewContext$: Observable<BaseViewContext>;
  baseView$: Observable<DefaultBaseControllerService>;
  selection$: Observable<SankeySelectionService>;
  predefinedValueAccessor$: Observable<object>;
  layout$: Observable<DefaultLayoutService>;
  graph$: Observable<object>;
  unsavedChanges$ = new Subject<boolean>();

  predefinedValueAccessors$: Observable<any> = this.sankeyController.predefinedValueAccessors$;
  paramsSubscription: Subscription;


  private dynamicComponentRef = new Map();

  @ViewChild(SankeyDirective, {static: true}) sankeySlot;
  @ViewChild(SankeyDetailsPanelDirective, {static: true}) detailsSlot;
  @ViewChild(SankeyAdvancedPanelDirective, {static: true}) advancedSlot;
  returnUrl: string;
  loadTask: BackgroundTask<string, [FilesystemObject, GraphFile]>;
  openSankeySub: Subscription;
  ready = false;
  object: FilesystemObject;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  searchPanel$ = new BehaviorSubject(false);
  advancedPanel = false;
  currentFileId;
  entitySearchTerm$ = new ReplaySubject<string>(1);

  isArray = Array.isArray;
  entitySearchList$ = new BehaviorSubject([]);
  _entitySearchListIdx$ = new ReplaySubject<number>(1);
  networkTracesMap$ = this.sankeyController.networkTraces$.pipe(
    map(networkTraces => new ExtendedMap(
      networkTraces.map((networkTrace, index) => [index, networkTrace])
    )),
  );
  data$ = this.sankeyController.data$;

  networkTracesAndViewsMap$ = this.sankeyController.networkTraces$.pipe(
    switchMap(networkTraces =>
      combineLatest(
        networkTraces.map((networkTrace, index) =>
          networkTrace.views$.pipe(
            map(views => [
              [`nt_${index}`, networkTrace],
              ...Object.entries(views).map(([id, view]) => ([`view_${index}_${id}`, view]))
            ] as [string, TraceNetwork | View][])
          ),
        )
      )
    ),
    map(nestedOptions => new ExtendedMap(flatMap(nestedOptions))),
    debug('networkTracesAndViewsMap$')
  );

  activeViewBaseName$: Observable<string> = this.viewController.activeViewBase$.pipe(
    map(activeViewBase => viewBaseToNameMapping[activeViewBase]),
    debug('activeViewBaseName$'),
    shareReplay({bufferSize: 1, refCount: true})
  );

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly route: ActivatedRoute,
    readonly modalService: NgbModal,
    readonly snackBar: MatSnackBar,
    protected readonly workSpaceManager: WorkspaceManager,
    readonly router: Router,
    readonly filesystemObjectActions: FilesystemObjectActions,
    readonly warningController: WarningControllerService,
    readonly viewService: ViewService,
    private componentFactoryResolver: ComponentFactoryResolver,
    public sankeyController: ControllerService,
    private injector: Injector,
    private zone: NgZone,
    private viewController: ViewControllerService,
    private search: SankeySearchService,
    public update: SankeyUpdateService,
    private readonly messageDialog: MessageDialog,
  ) {
    this.loadTask = new BackgroundTask(hashId =>
      combineLatest([
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        ) as Observable<GraphFile>
      ])
    );

    // Listener for file open
    this.loadTask.results$.pipe(
      switchMap(({result: [object, content]}) => {
        this.object = object;
        this.emitModuleProperties();
        this.currentFileId = object.hashId;
        if (this.sanityChecks(content)) {
          this.fileContent = content;
          return this.sankeyController.loadData(content);
        }
      })
    ).subscribe(() => {
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    this.route.fragment.pipe(
      switchMap(fragment =>
        // pipe on this.parseUrlFragmentToState, so it does only kill its observable upon error
        // (do not kill route observable)
        this.parseUrlFragmentToState(fragment).pipe(          // set base view from content if not given in url
          catchError((err, o) => {
            this.snackBar.open('Referenced view could not be found.', null, {duration: 2000});
            // return empty observable so does not continue with that one
            return EMPTY;
          })
        )
      ),
      tap(stateDelta => this.sankeyController.delta$.next(stateDelta))
    ).subscribe(state => {
    });

    this.route.params.subscribe(({file_id}: { file_id: string }) => {
      this.object = null;
      this.currentFileId = null;
      this.openSankey(file_id);
    });

    this.sankeyController.viewsUpdate$.pipe(
      switchMap(() => this.sankeyController.data$)
    ).subscribe(data => this.saveFile(data));

    this.search.term$.pipe(
      startWith(false),
      map(term => !!term)
    ).subscribe(open => {
      this.searchPanel$.next(open);
    });
  }

  state$ = this.sankeyController.state$;
  options$ = this.sankeyController.options$;
  networkTrace$ = this.sankeyController.networkTrace$;

  detailsPanel$ = new BehaviorSubject(false);

  viewName$ = this.sankeyController.viewName$;

  viewBase = ViewBase;

  order = (a: KeyValue<number, string>, b: KeyValue<number, string>): number => 0;

  selectView(networkTraceIdx, viewName) {
    return this.viewController.selectView(networkTraceIdx, viewName);
  }

  traceAndViewNameAccessor = (networkTraceOrViewId, traceOrView) => {
    return this.applyOnNetworkTraceOrView(
      networkTraceOrViewId,
      traceId => traceOrView.name ?? traceOrView.description,
      (_, viewId) => `+ ${viewId}`
    );
  }

  confirmDeleteView(viewName): Promise<any> {
    return this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => this.viewController.deleteView(viewName).toPromise());
  }

  ngOnInit() {
    /**
     * Load different base view components upom base view change
     */
    this.baseViewContext$ = this.sankeyController.baseViewName$.pipe(
      map(baseViewName => {
        const module = baseViewName === ViewBase.sankeyMultiLane ? MultiLaneBaseModule : SingleLaneBaseModule;
        const moduleFactory = getModuleFactory(baseViewName);
        const moduleRef = moduleFactory.create(this.injector);
        const injectComponent = (container, token) => {
          container.clear();
          const comp = moduleRef.injector.get(token);
          const factory = moduleRef.componentFactoryResolver.resolveComponentFactory(comp);
          const componentRef = container.createComponent(factory, null, moduleRef.injector, null);
          return componentRef;
        };

        const sankey = injectComponent(this.sankeySlot.viewContainerRef, SANKEY_GRAPH);

        this.dynamicComponentRef.set('sankey', sankey);
        this.dynamicComponentRef.set('advanced', injectComponent(this.advancedSlot.viewContainerRef, SANKEY_ADVANCED));
        this.dynamicComponentRef.set('details', injectComponent(this.detailsSlot.viewContainerRef, SANKEY_DETAILS));

        return {
          baseView: moduleRef.injector.get(BaseControllerService),
          layout: sankey.instance.sankey,
          selection: moduleRef.injector.get(SankeySelectionService)
        };
      }),
      tap(({layout, baseView}) => {
        this.viewController.layout$.next(layout);
        baseView.delta$.next({});
      }),
      debug('baseViewContext$'),
      shareReplay<BaseViewContext>(1)
    );

    this.baseView$ = this.baseViewContext$.pipe(
      map(({baseView}) => baseView)
    );
    this.predefinedValueAccessor$ = this.baseView$.pipe(
      switchMap(sankeyBaseViewControl => sankeyBaseViewControl.predefinedValueAccessor$)
    );
    this.layout$ = this.baseViewContext$.pipe(
      map(({layout}) => layout)
    );
    this.graph$ = this.layout$.pipe(
      switchMap<DefaultLayoutService, Observable<object>>(layout => layout.graph$)
    );
    this.selection$ = this.baseViewContext$.pipe(
      map(({selection}) => selection)
    );

    this.selection$.pipe(
      switchMap(selection => selection.selection$),
      map(isNotEmpty)
    ).subscribe(open => {
      // oddly it runs out of sync with angular template
      // if we do not force it into zone template will not update
      this.zone.run(() => {
        this.detailsPanel$.next(open);
      });
    });
  }

  ngAfterViewInit() {
    this.baseViewContext$.subscribe();
  }

  sanityChecks({graph: {trace_networks}, nodes, links}: GraphFile) {
    let pass = true;
    if (!trace_networks.length) {
      this.warningController.warn(ErrorMessages.missingNetworkTraces, false);
      pass = false;
    }
    if (!nodes.length) {
      this.warningController.warn(ErrorMessages.missingNodes, false);
      pass = false;
    }
    if (!links.length) {
      this.warningController.warn(ErrorMessages.missingLinks, false);
      pass = false;
    }
    return pass;
  }

  /**
   * Temporary safty net SankeyDocument is under development
   * SankeyDocument.toDict() should give stringable representation of file
   * and SankeyDocument.toString() should encode it as string.
   * Ultimatly for given FileContent:
   * `new SankeyDocument(FileContent).toString() = FileContent`
   * yet current implementation cannot guarantee that just yet.
   */
  updateOnlyViews(sankeyDocument: SankeyDocument) {
    const {graph: {traceNetworks}} = sankeyDocument;
    const {graph: {trace_networks, ...fcGraph}, ...fc} = this.fileContent;
    return {
      graph: {
        ...fcGraph,
        trace_networks: zip(traceNetworks, trace_networks).map(([tn, fctn]) => ({
          ...fctn,
          _views: tn.toDict()._views
        }))
      },
      ...fc
    };
  }

  saveFile(data: SankeyDocument) {
    const newContent = this.updateOnlyViews(data);
    const contentValue = new Blob(
      [JSON.stringify(newContent)],
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
      ).toPromise();
  }

  selectNetworkTrace = networkTraceIdx => this.sankeyController.selectNetworkTrace(networkTraceIdx);

  applyOnNetworkTraceOrView(networkTraceOrViewId, networkTraceCallback, viewCallback) {
    // Kinda ugly fix to maintain search functionality working with views in here
    if (networkTraceOrViewId.startsWith('nt_')) {
      const networkTraceIdx = Number(networkTraceOrViewId.replace('nt_', ''));
      return networkTraceCallback(networkTraceIdx);
    }
    if (networkTraceOrViewId.startsWith('view_')) {
      const [, networkTraceIdx, viewId] = networkTraceOrViewId.match(/^view_(\d+)_(.+)$/);
      return viewCallback(Number(networkTraceIdx), viewId);
    }
    throw new Error('Unknown option prefix');
  }

  selectNetworkTraceOrView(networkTraceOrViewIdx) {
    return this.baseView$.pipe(
      first(),
      tap(baseView => baseView.delta$.next({})),
      switchMap(() => this.applyOnNetworkTraceOrView(
        networkTraceOrViewIdx,
        this.selectNetworkTrace.bind(this),
        this.selectView.bind(this)
      ))
    ).toPromise();
  }

  confirm({header, body}): Promise<any> {
    const modal = this.modalService.open(
      SankeyConfirmComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    modal.componentInstance.header = header;
    modal.componentInstance.body = body;
    return modal.result;
  }

  confirmCreateView(viewName) {
    return this.viewController.views$.pipe(
      first(),
      switchMap(views =>
        iif(
          () => !!views[viewName],
          defer(() => this.confirm({
            header: 'View already exists',
            body: `View ${viewName} already exists. Do you want to overwrite it?`
          })),
          // of(true)
          // As of Tim requirement ensure that view name is unique in file.
          this.sankeyController.networkTraces$.pipe(
            first(),
            switchMap(networkTraces =>
              iif(
                () => networkTraces.some(nt => nt.views?.[viewName]),
                defer(() => this.messageDialog.display({
                  title: 'View name is not unique',
                  message: 'View name needs to be unique across all trace networks.',
                  type: MessageType.Error,
                })).pipe(
                  tap(() => {
                    throw new Error('View name is not unique');
                  })
                ),
                of(true)
              )
            )
          )
        )
      ),
      switchMap(overwrite =>
        iif(
          () => overwrite,
          defer(() => this.viewController.createView(viewName)),
          of(false)
        )
      )
    );
  }

  saveView(): Promise<any> {
    return this.viewController.activeViewName$.pipe(
      first(),
      switchMap(viewName =>
        iif(
          () => viewName,
          defer(() => this.viewController.createView(viewName)),
          defer(() => this.saveViewAs())
        )
      )
    ).toPromise();
  }

  saveViewAs(): Promise<any> {
    const dialogRef = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    dialogRef.componentInstance.accept = ({viewName}) => this.confirmCreateView(viewName).toPromise();
    return dialogRef.result;
  }

  openBaseView(baseViewName: ViewBase): Promise<any> {
    return this.viewController.openBaseView(baseViewName).toPromise();
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
    let viewId;
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
        case SankeyURLLoadParam.SEARCH_TERMS:
          // todo: parse search terms
          break;
        default:
          viewId = param;
      }
    }
    if (!isNil(viewId)) {
      return this.viewService.get(viewId).pipe(
        tap(view => Object.assign(view, state))
      );
    }
    return of(state);
  }

  openPathReport() {
    const modalRef = this.open(PathReportComponent);
    this.sankeyController.pathReports$.subscribe(pathReports => {
      modalRef.componentInstance.pathReport = pathReports;
    });
  }

  resetView() {
    combineLatest([
      this.sankeyController.resetView(),
      this.baseViewContext$.pipe(
        first(),
        tap(({baseView, layout, selection}) => {
          baseView.delta$.next({});
          selection.reset();
        })
      )
    ]).toPromise();
    this.resetZoom();
  }

  // region Zoom
  resetZoom() {
    if (this.sankeySlot) {
      this.sankey.zoom.reset();
    }
  }

  zoomIn() {
    if (this.sankeySlot) {
      this.sankey.zoom.scaleBy(1.25);
    }
  }

  zoomOut() {
    if (this.sankeySlot) {
      this.sankey.zoom.scaleBy(.8);
    }
  }

  // endregion

  openDetailsPanel() {
    this.detailsPanel$.next(true);
  }

  closeDetailsPanel() {
    this.detailsPanel$.next(false);
  }

  closeSearchPanel() {
    this.searchPanel$.next(false);
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

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.openSankey(this.currentFileId);
    }
  }

  ngOnDestroy() {
    this.paramsSubscription.unsubscribe();
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

  selectPredefinedValueAccessor(predefinedValueAccessorId) {
    return this.baseView$.pipe(
      switchMap(baseView =>
        baseView.patchState({
          predefinedValueAccessorId,
          nodeValueAccessorId: null,
          linkValueAccessorId: null
        })
      ),
      first()
    ).toPromise();
  }
}
