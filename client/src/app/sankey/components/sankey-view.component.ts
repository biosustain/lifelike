import {
  Component,
  EventEmitter,
  OnDestroy,
  ViewChild,
  ComponentFactoryResolver,
  Injector,
  AfterViewInit,
  ChangeDetectorRef,
  getModuleFactory,
  NgZone
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { tap, switchMap, catchError, map, delay, first, pairwise, startWith, shareReplay } from 'rxjs/operators';
import { Subscription, BehaviorSubject, Observable, of, ReplaySubject, combineLatest, EMPTY } from 'rxjs';
import { isNil, pick, assign } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { SankeyState, SankeyURLLoadParam, ViewBase, SankeyData } from 'app/sankey/interfaces';
import { ViewService } from 'app/file-browser/services/view.service';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { mapBufferToJson, mapBlobToBuffer } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { isNotEmpty } from 'app/shared/utils';

import { SankeySearchService } from '../services/search.service';
import { PathReportComponent } from './path-report/path-report.component';
import { SankeyAdvancedPanelDirective } from '../directives/advanced-panel.directive';
import { SankeyDetailsPanelDirective } from '../directives/details-panel.directive';
import { SankeyDirective } from '../directives/sankey.directive';
import { ControllerService } from '../services/controller.service';
import { BaseControllerService } from '../services/base-controller.service';
import { MultiLaneBaseModule } from '../base-views/multi-lane/sankey-viewer-lib.module';
import { SingleLaneBaseModule } from '../base-views/single-lane/sankey-viewer-lib.module';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from '../DI';
import { LayoutService } from '../services/layout.service';
import { ViewControllerService } from '../services/view-controller.service';
import { SankeySelectionService } from '../services/selection.service';

@Component({
  selector: 'app-sankey-viewer',
  templateUrl: './sankey-view.component.html',
  styleUrls: ['./sankey-view.component.scss'],
  providers: [
    WarningControllerService,
    SankeySearchService,
    ControllerService,
    ViewControllerService
  ]
})
export class SankeyViewComponent implements OnDestroy, ModuleAwareComponent, AfterViewInit {
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
    public sankeyController: ControllerService,
    private injector: Injector,
    private zone: NgZone,
    private viewController: ViewControllerService,
    private search: SankeySearchService
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
          return this.sankeyController.loadData(content as SankeyData);
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

    this.baseView$.pipe(
      switchMap(({graphInputState$}) => graphInputState$),
      startWith({}), // initial prev value,
      pairwise(),
    ).subscribe(([prevInputState, inputState]) => {
      const sankey = this.dynamicComponentRef.get('sankey');
      assign(sankey.instance, inputState);
      sankey.changeDetectorRef.detectChanges();
      sankey.injector.get(ChangeDetectorRef).detectChanges();
    });

    this.sankeyController.viewsUpdate$.pipe(
      switchMap(_views => this.sankeyController.data$.pipe(
        map(data => ({...data, _views}))
      ))
    ).subscribe(data => this.saveFile(data));

    this.search.term$.pipe(
      startWith(false),
      map(term => !!term)
    ).subscribe(open => {
      this.searchPanel$.next(open);
    });

    this.selection$.pipe(
      switchMap(selection => selection.selection$),
      map(isNotEmpty)
    ).subscribe(open => {
      this.detailsPanel$.next(open);
    });
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

  predefinedValueAccessors$ = this.sankeyController.predefinedValueAccessors$;


  private dynamicComponentRef = new Map();

  @ViewChild(SankeyDirective, {static: true}) sankeySlot;
  @ViewChild(SankeyDetailsPanelDirective, {static: true}) detailsSlot;
  @ViewChild(SankeyAdvancedPanelDirective, {static: true}) advancedSlot;

  paramsSubscription: Subscription;
  returnUrl: string;
  loadTask: BackgroundTask<string, [FilesystemObject, GraphFile]>;
  openSankeySub: Subscription;
  ready = false;
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sankeyjs-dist/index.d.ts
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  searchPanel$ = new BehaviorSubject(false);
  advancedPanel = false;
  object: FilesystemObject;
  currentFileId;

  isArray = Array.isArray;

  entitySearchTerm$ = new ReplaySubject<string>(1);
  entitySearchList$ = new BehaviorSubject([]);
  _entitySearchListIdx$ = new ReplaySubject<number>(1);


  networkTraces$ = this.sankeyController.networkTraces$;


  data$ = this.sankeyController.data$;
  state$ = this.sankeyController.state$;
  options$ = this.sankeyController.options$;
  networkTrace$ = this.sankeyController.networkTrace$;

  /**
   * Load different base view components upom base view change
   */
  baseViewContext$ = this.sankeyController.baseView$.pipe(
    map(({baseViewName, baseViewInitState = {}}) => {
      const module = baseViewName === ViewBase.sankeyMultiLane ? MultiLaneBaseModule : SingleLaneBaseModule;
      const moduleFactory = getModuleFactory(baseViewName);
      const moduleRef = moduleFactory.create(this.injector);
      const injectComponent = (container, token) => {
        const comp = moduleRef.injector.get(token);
        const factory = moduleRef.componentFactoryResolver.resolveComponentFactory(comp);
        container.clear();
        const componentRef = container.createComponent(factory, null, moduleRef.injector, null);
        return componentRef;
      };

      this.dynamicComponentRef.set('sankey', injectComponent(this.sankeySlot.viewContainerRef, SANKEY_GRAPH));
      this.dynamicComponentRef.set('advanced', injectComponent(this.advancedSlot.viewContainerRef, SANKEY_ADVANCED));
      this.dynamicComponentRef.set('details', injectComponent(this.detailsSlot.viewContainerRef, SANKEY_DETAILS));

      return {
        baseView: moduleRef.injector.get(BaseControllerService),
        layout: moduleRef.injector.get(LayoutService),
        selection: moduleRef.injector.get(SankeySelectionService),
        baseViewInitState
      };
    }),
    tap(({layout, baseView, baseViewInitState}) => {
      this.viewController.layout$.next(layout);
      baseView.delta$.next(baseViewInitState);
    }),
    shareReplay(1)
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
  dataToRender$ = this.layout$.pipe(
    switchMap(layout => layout.dataToRender$)
  );
  selection$ = this.baseViewContext$.pipe(
    map(({selection}) => selection)
  );
  detailsPanel$ = new BehaviorSubject(false);

  ngAfterViewInit() {
    this.baseViewContext$.subscribe();
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


  saveFile(data: GraphFile) {
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
      ).toPromise();
  }

  async selectNetworkTrace(networkTraceIdx) {
    await this.sankeyController.selectNetworkTrace(networkTraceIdx).toPromise();
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
      modalRef.componentInstance.pathReports = pathReports;
    });
  }

  resetView() {
    this.sankeyController.delta$.next({});
    this.sankey.resetZoom();
  }

  // region Zoom
  resetZoom() {
    if (this.sankeySlot) {
      this.sankey.resetZoom();
    }
  }

  zoomIn() {
    if (this.sankeySlot) {
      this.sankey.scaleZoom(1.25);
    }
  }

  zoomOut() {
    if (this.sankeySlot) {
      this.sankey.scaleZoom(.8);
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
      first(),
      switchMap(baseView =>
        baseView.selectPredefinedValueAccessor(predefinedValueAccessorId)
      ),
    ).toPromise();
  }
}
