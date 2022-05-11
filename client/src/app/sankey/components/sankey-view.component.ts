import {
  Component,
  EventEmitter,
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
import { tap, switchMap, catchError, map, first, startWith, shareReplay, delay } from 'rxjs/operators';
import { BehaviorSubject, Observable, of, combineLatest, EMPTY, iif, defer, Subject } from 'rxjs';
import { isNil, pick, flatMap } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { SankeyState, ViewBase } from 'app/sankey/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { isNotEmpty } from 'app/shared/utils';
import { debug } from 'app/shared/rxjs/debug';
import { ExtendedMap } from 'app/shared/utils/types';

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
import { SankeyURLLoadParam } from '../interfaces/url';
import { SankeyUpdateService } from '../services/sankey-update.service';
import { SankeyViewCreateComponent } from './view/create/view-create.component';
import { SankeyConfirmComponent } from './confirm.component';
import { viewBaseToNameMapping } from '../constants/view-base';
import { TraceNetwork, View, SankeyFile } from '../model/sankey-document';
import { SankeyFileService } from '../services/file.service';

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
    SankeyUpdateService,
    SankeyFileService
  ]
})
export class SankeyViewComponent implements OnInit, ModuleAwareComponent, AfterViewInit {
  constructor(
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
    private file: SankeyFileService
  ) {
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
    ).subscribe(state => {
      this.sankeyController.delta$.next(state);
    });

    this.sankeyController.viewsUpdate$.subscribe(() => this.saveFile());

    this.search.term$.pipe(
      startWith(false),
      map(term => !!term)
    ).subscribe(open => {
      this.searchPanel$.next(open);
    });

    this.sankeyFile$.pipe(
      switchMap(sankeyFile => sankeyFile.metadata$),
    ).subscribe(metadata => {
      this.modulePropertiesChange.next({
        title: metadata.filename,
        fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
      });
    });

    this.sankeyFile$.pipe(
      switchMap(sankeyFile => sankeyFile.document$),
    ).subscribe(document =>
      this.sankeyController.data$.next(document)
    );
  }

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

  returnUrl$ = this.route.queryParams.pipe(
    map(params => params.return)
  );
  baseViewContext$: Observable<BaseViewContext>;
  baseView$: Observable<DefaultBaseControllerService>;
  selection$: Observable<SankeySelectionService>;
  predefinedValueAccessor$: Observable<object>;
  layout$: Observable<DefaultLayoutService>;
  graph$: Observable<object>;
  unsavedChanges$ = new Subject<boolean>();

  predefinedValueAccessors$: Observable<any> = this.sankeyController.predefinedValueAccessors$;

  private dynamicComponentRef = new Map();

  @ViewChild(SankeyDirective, {static: true}) sankeySlot;
  @ViewChild(SankeyDetailsPanelDirective, {static: true}) detailsSlot;
  @ViewChild(SankeyAdvancedPanelDirective, {static: true}) advancedSlot;

  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  searchPanel$ = new BehaviorSubject(false);
  advancedPanel = false;

  isArray = Array.isArray;

  hashId$ = this.route.params.pipe(
    map(({file_id}: { file_id: string }) => file_id)
  );
  sankeyFile$: Observable<SankeyFile> = this.hashId$.pipe(
    map(hashId => this.file.get(hashId)),
    catchError((err, caught) => {
      this.warningController.warn(err);
      return caught;
    })
  );

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

  document$ = this.sankeyFile$.pipe(
    switchMap(sankeyFile => sankeyFile.document$),
    shareReplay()
  );
  state$ = this.sankeyController.state$;
  options$ = this.sankeyController.options$;
  networkTrace$ = this.sankeyController.networkTrace$;

  detailsPanel$ = new BehaviorSubject(false);

  viewName$ = this.sankeyController.viewName$;

  viewBase = ViewBase;

  order = (a: KeyValue<number, string>, b: KeyValue<number, string>): number => 0;

  selectView(networkTraceIdx, viewName) {
    return this.baseView$.pipe(
      first(),
      tap(baseView => baseView.delta$.next({})),
      switchMap(() => this.viewController.selectView(networkTraceIdx, viewName))
    ).toPromise();
  }

  traceAndViewNameAccessor = (networkTraceOrViewId, traceOrView) => {
    return this.applyOnNetworkTraceOrView(
      networkTraceOrViewId,
      traceId => traceOrView.name ?? traceOrView.description,
      (_, viewId) => `+ ${viewId}`
    );
  };

  metadata$ = this.sankeyFile$.pipe(
    switchMap(sankeyFile => sankeyFile.metadata$),
    shareReplay({bufferSize: 1, refCount: true})
  );

  metadataLoadStatus$ = this.sankeyFile$.pipe(
    switchMap(file => file.metaLoadTask.status$),
    shareReplay({bufferSize: 1, refCount: true})
  );

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

  saveFile() {
    return this.sankeyFile$.pipe(
      switchMap(sankeyFile => sankeyFile.save()),
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
        return of();
      })
    ).toPromise();
  }

  selectNetworkTrace = networkTraceIdx => this.sankeyController.selectNetworkTrace(networkTraceIdx).toPromise();

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
    return this.applyOnNetworkTraceOrView(
      networkTraceOrViewIdx,
      this.selectNetworkTrace.bind(this),
      this.selectView.bind(this)
    );
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
          of(true)
        )
      ),
      switchMap(overwrite =>
        iif(
          () => overwrite,
          this.viewController.createView(viewName),
          of(false)
        )
      )
    );
  }

  saveView(): Promise<any> {
    const createDialog = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    return createDialog.result.then(({viewName}) => this.confirmCreateView(viewName).toPromise());
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
    this.sankeyController.data$.pipe(
      first(),
      // tap(data => this.sankeyController.data = data)
    ).toPromise();
    this.sankeyController.delta$.next({});
    this.baseViewContext$.pipe(
      first(),
      tap(({baseView, layout, selection}) => {
        baseView.delta$.next({});
        selection.reset();
      })
    ).subscribe();
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

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      return this.sankeyFile$.pipe(
        tap(sankeyFile => sankeyFile.reload())
      ).toPromise();
    }
  }


  openNewWindow() {
    return this.sankeyFile$.pipe(
      first(),
      switchMap(sankeyFile => sankeyFile.metadata$),
      map(object => this.filesystemObjectActions.openNewWindow(object))
    ).toPromise();
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    this.sankeyFile$.pipe(
      first(),
      switchMap(sankeyFile => sankeyFile.metadata$),
      map(({filename, hashId, project}) => {
        dataTransfer.setData('text/plain', filename);
        dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
          display_name: filename,
          label: 'link',
          sub_labels: [],
          data: {
            references: [{
              type: 'PROJECT_OBJECT',
              id: hashId + '',
            }],
            sources: [{
              domain: filename,
              url: ['/projects', encodeURIComponent(project.name),
                'sankey', encodeURIComponent(hashId)].join('/'),
            }],
          },
        }));
      })
    ).toPromise();
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
