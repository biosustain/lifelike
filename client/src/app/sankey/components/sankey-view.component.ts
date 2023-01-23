import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  EventEmitter,
  getModuleFactory,
  HostListener,
  Injector,
  NgZone,
  OnInit,
  ViewChild,
  NgModuleRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { KeyValue } from '@angular/common';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  catchError,
  delay,
  first,
  map,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
  scan,
} from 'rxjs/operators';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  EMPTY,
  iif,
  Observable,
  of,
  ReplaySubject,
  Subject,
  Subscription,
} from 'rxjs';
import { assign, isNil, omitBy, zip } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties, ShouldConfirmUnload } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { SankeyState, ViewBase } from 'app/sankey/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { isNotEmpty } from 'app/shared/utils';
import { debug } from 'app/shared/rxjs/debug';
import { ExtendedMap } from 'app/shared/utils/types';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';

import { SankeySearchService } from '../services/search.service';
import { PathReportComponent } from './path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from '../directives/advanced-panel.directive';
import { SankeyDetailsPanelDirective } from '../directives/details-panel.directive';
import { SankeyDirective } from '../directives/sankey.directive';
import { ControllerService } from '../services/controller.service';
import {
  BaseControllerService,
  DefaultBaseControllerService,
} from '../services/base-controller.service';
import { MultiLaneBaseModule } from '../base-views/multi-lane/sankey-viewer-lib.module';
import { SingleLaneBaseModule } from '../base-views/single-lane/sankey-viewer-lib.module';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from '../constants/DI';
import { DefaultLayoutService } from '../services/layout.service';
import { ViewControllerService } from '../services/view-controller.service';
import { SankeySelectionService } from '../services/selection.service';
import { ErrorMessages } from '../constants/error';
import { SankeyURLLoadParam, SankeyURLLoadParams } from '../interfaces/url';
import { EditService } from '../services/edit.service';
import { SankeyViewCreateComponent } from './view/create/view-create.component';
import { SankeyConfirmComponent } from './confirm.component';
import { viewBaseToNameMapping } from '../constants/view-base';
import { SankeyDocument } from '../model/sankey-document';

interface BaseViewContext {
  moduleRef: NgModuleRef<any>;
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
    EditService,
    ModuleContext
  ]
})
export class SankeyViewComponent implements OnInit, ModuleAwareComponent, AfterViewInit, ShouldConfirmUnload {
  searchParams$ = this.sankeyController.state$.pipe(
    map(({networkTraceIdx, viewName, baseView}) =>
      omitBy(
        {
          [SankeyURLLoadParam.NETWORK_TRACE_IDX]: networkTraceIdx,
          [SankeyURLLoadParam.VIEW_NAME]: viewName,
          [SankeyURLLoadParam.BASE_VIEW_NAME]: baseView
        },
        isNil
      ) as SankeyURLLoadParams
    )
  );

  get linkParams() {
    return this.searchParams$.pipe(first()).toPromise();
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

  get isStandalone() {
    // No idea for better check
    return !this.workSpaceManager.panes$.value.length;
  }

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
    public update: EditService,
    private readonly messageDialog: MessageDialog,
    private readonly moduleContext: ModuleContext
  ) {
    this.moduleContext.register(this);

    this.loadTask = new BackgroundTask(hashId =>
      combineLatest([
        this.filesystemService.open(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson()
        ) as Observable<GraphFile>
      ])
    );

    // Listener for file open
    this.loadTask.results$.pipe(
      switchMap(({result: [object, content]}) => {
        this.object$.next(object);
        this.currentFileId = object.hashId;
        if (this.sanityChecks(content)) {
          this.fileContent = content;
          return this.sankeyController.loadData(content);
        } else {
          return of(null);
        }
      })
    ).subscribe(() => {
    });

    // Does work only in standalone view cause current tab implementation only mockups some router options
    if (this.isStandalone) {
      this.searchParams$.subscribe(queryParams =>
        this.workSpaceManager.navigate(
          [],
          {
            relativeTo: this.route,
            queryParams
            // queryParamsHandling: 'merge'
          })
      );
    }

    this.route.params.pipe(
      tap(({file_id}: { file_id: string }) => {
        this.currentFileId = null;
        this.openSankey(file_id);
      }),
      switchMap(() =>
        combineLatest([
          this.route.queryParams.pipe(
            map(({return: returnUrl, ...params}) => {
              this.returnUrl = returnUrl;
              return this.parseUrlQueryParamsToState(params as SankeyURLLoadParams);
            })
          ),
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
            )
          )
        ]).pipe(
          map(deltas => assign({}, ...deltas))
        )
      )
    ).subscribe(delta => {
      this.sankeyController.delta$.next(delta);
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

    this.moduleProperties$.subscribe(this.modulePropertiesChange);
  }

  fileContent: GraphFile;

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
  object$ = new ReplaySubject<FilesystemObject>(1);
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


  activeViewBaseName$: Observable<string> = this.viewController.activeViewBase$.pipe(
    map(activeViewBase => viewBaseToNameMapping[activeViewBase]),
    debug('activeViewBaseName$'),
    shareReplay({bufferSize: 1, refCount: true})
  );

  pendingChanges$ = defer(() => this.baseView$.pipe(
    switchMap(baseView => baseView.hasPendingChanges$),
    startWith(false),
  ));

  state$ = this.sankeyController.state$;
  options$ = this.sankeyController.options$;
  networkTrace$ = this.sankeyController.networkTrace$;

  detailsPanel$ = new BehaviorSubject(false);

  viewName$ = this.sankeyController.viewName$;

  viewBase = ViewBase;

  /**
   * Load different base view components upon base view change
   */
  baseViewContext$ = this.sankeyController.baseViewName$.pipe(
    scan((prev, baseViewName) => {
      prev.moduleRef?.destroy();

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
        moduleRef,
        baseView: moduleRef.injector.get(BaseControllerService),
        layout: sankey.instance.sankey,
        selection: moduleRef.injector.get(SankeySelectionService)
      };
    }, {} as BaseViewContext),
    tap(({layout, baseView}) => {
      this.viewController.layout$.next(layout);
      baseView.delta$.next({});
    }),
    debug('baseViewContext$'),
    shareReplay<BaseViewContext>(1)
  );

  baseView$ = this.baseViewContext$.pipe(
    map(({baseView}) => baseView)
  );
  predefinedValueAccessor$ = this.baseView$.pipe(
    switchMap(sankeyBaseViewControl => sankeyBaseViewControl.predefinedValueAccessor$)
  );
  layout$ = this.baseViewContext$.pipe(
    map(({layout}) => layout)
  );
  graph$ = this.layout$.pipe(
    switchMap<DefaultLayoutService, Observable<any>>(layout => layout.graph$)
  );
  selection$ = this.baseViewContext$.pipe(
    map(({selection}) => selection)
  );

  moduleProperties$ = combineLatest([
    this.object$,
    this.baseView$.pipe(
      switchMap(baseView => baseView.hasPendingChanges$)
    )
  ]).pipe(
    map(([{filename}, edited]) => ({
      title: filename,
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
      badge: edited ? '*' : undefined
    }))
  );

  dragTitleData$ = this.object$.pipe(
    switchMap(object =>
      defer(() => this.moduleContext.appLink).pipe(
        map(url => ({
          'text/plain': object.filename,
          'application/***ARANGO_DB_NAME***-node': JSON.stringify({
            display_name: object.filename,
            label: 'link',
            sub_labels: [],
            data: {
              references: [{
                type: 'PROJECT_OBJECT',
                id: object.hashId + '',
              }],
              sources: [{
                domain: object.filename,
                url,
              }],
            },
          } as Partial<UniversalGraphNode>),
          ...GenericDataProvider.getURIs([{
            uri: object.getURL(false).toAbsolute(),
            title: object.filename,
          }]),
        }))
      )
    )
  );


  sourceData$ = defer(() => this.object$.pipe(map(object => object.getGraphEntitySources())));


  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    return Promise.resolve(this.shouldConfirmUnload).then(shouldConfirmUnload => {
      if (shouldConfirmUnload) {
        event.returnValue = 'Leave page? Changes you made may not be saved';
      }
    });
  }

  get shouldConfirmUnload() {
    return this.pendingChanges$.pipe(
      first()
    ).toPromise();
  }


  order = (a: KeyValue<number, string>, b: KeyValue<number, string>): number => 0;

  confirmUnloadWrapper = <T>(project: Observable<T>) =>
    this.pendingChanges$.pipe(
      first(),
      switchMap(pendingChanges =>
        iif(
          () => pendingChanges,
          defer(() => this.confirmUnloadView()),
          of({})
        )
      ),
      switchMap(() => project)
    )

  selectView({networkTraceIdx, viewName}) {
    return this.baseViewContext$.pipe(
      this.confirmUnloadWrapper,
      tap(({baseView, layout, selection}) => {
        baseView.delta$.next({});
        selection.reset();
        this.update.reset();
      }),
      switchMap(() =>
        this.viewController.selectView(networkTraceIdx, viewName)
      ),
      tap(() => {
        this.resetZoom(false);
        this.resetStretch();
      }),
      take(1),
      catchError(() => of({}))
    ).toPromise();
  }

  confirmUnloadView(): Promise<any> {
    return this.confirm({
      header: 'Confirm navigation',
      body: `Are you sure you want to drop unsaved changes in open view?`
    });
  }

  confirmDeleteView({networkTraceIdx, viewName}): Promise<any> {
    return this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' (${networkTraceIdx}) view?`
    }).then(() => this.viewController.deleteView({networkTraceIdx, viewName}).toPromise());
  }

  ngOnInit() {

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
    return this.object$.pipe(
      switchMap(object => this.filesystemService.save(
        [object.hashId],
        {contentValue}
      )
        .pipe(
          delay(1000),
          tap(() => {
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
        ))
    ).toPromise();
  }

  selectNetworkTraceIdx(networkTraceIdx) {
    return this.baseViewContext$.pipe(
      this.confirmUnloadWrapper,
      tap(({baseView, layout, selection}) => {
        baseView.delta$.next({});
        selection.reset();
        this.update.reset();
      }),
      switchMap(() =>
        this.sankeyController.selectNetworkTrace(networkTraceIdx)
      ),
      tap(() => {
        this.resetZoom(false);
        this.resetStretch();
      }),
      take(1),
      catchError(() => of({}))
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
          defer(() => this.viewController.createView(viewName)).pipe(
            tap(() => this.resetStretch())
          ),
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
    ).toPromise().then(() => this.resetStretch());
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
    return this.confirmUnloadWrapper(
      this.viewController.openBaseView(baseViewName),
    ).pipe(
      take(1),
      catchError(() => of({}))
    ).toPromise();
  }

  open(content) {
    const modalRef = this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    });
    modalRef.result
      .then(_ => _, _ => _);
    return modalRef;
  }

  parseUrlQueryParamsToState({
                               [SankeyURLLoadParam.NETWORK_TRACE_IDX]: networkTraceIdx,
                               [SankeyURLLoadParam.VIEW_NAME]: viewName,
                               [SankeyURLLoadParam.BASE_VIEW_NAME]: baseView,
                               [SankeyURLLoadParam.SEARCH_TERMS]: searchTerms
                             }: SankeyURLLoadParams): Partial<SankeyState> {
    return omitBy({
      networkTraceIdx: networkTraceIdx ? Number(networkTraceIdx) : null,
      viewName,
      baseView
    }, isNil);
  }

  parseUrlFragmentToState(fragment: string): Observable<Partial<SankeyState>> {
    if (isNil(fragment)) {
      return of({});
    }
    return this.viewService.get(fragment);
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
          this.update.reset();
        })
      )
    ]).toPromise();
    this.resetStretch();
    this.resetZoom();
  }

  // region Zoom
  resetZoom(transition = true) {
    if (this.sankeySlot) {
      this.sankey.zoomToFit(transition);
    }
  }

  zoomIn() {
    if (this.sankeySlot) {
      this.sankey.zoom.scaleBy(1.25, undefined, true);
    }
  }

  zoomOut() {
    if (this.sankeySlot) {
      this.sankey.zoom.scaleBy(.8, undefined, true);
    }
  }

  // endregion

  // region Stretch
  resetStretch() {
    if (this.sankeySlot) {
      this.sankey.horizontalStretch$.next(1);
      this.sankey.verticalStretch$.next(1);
    }
  }

  horizontalStretch() {
    if (this.sankeySlot) {
      this.sankey.horizontalStretch$.next(this.sankey.horizontalStretch$.value * 1.25);
    }
  }

  horizontalShrink() {
    if (this.sankeySlot) {
      this.sankey.horizontalStretch$.next(this.sankey.horizontalStretch$.value * .8);
    }
  }

  verticalStretch() {
    if (this.sankeySlot) {
      this.sankey.verticalStretch$.next(this.sankey.verticalStretch$.value * 1.25);
    }
  }

  verticalShrink() {
    if (this.sankeySlot) {
      this.sankey.verticalStretch$.next(this.sankey.verticalStretch$.value * .8);
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
    this.ready = false;
    this.loadTask.update(hashId);
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.openSankey(this.currentFileId);
    }
  }

  openNewWindow() {
    return this.object$.pipe(
      map(object =>
        this.filesystemObjectActions.openNewWindow(object)
      )
    );
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
