import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { MapService } from '../services';
import { KnowledgeMap, UniversalGraph, UniversalGraphEntity } from '../services/interfaces';

import { MapExportDialogComponent } from './map-export-dialog.component';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ModuleAwareComponent, ModuleProperties } from '../../shared/modules';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { map, tap } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { CopyKeyboardShortcut } from '../../graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { Progress } from '../../interfaces/common-dialog.interface';
import { WorkspaceManager } from '../../shared/workspace-manager';

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: [
    './map-view.component.scss',
  ],
})
export class MapViewComponent<ExtraResult = void> implements OnDestroy, AfterViewInit, ModuleAwareComponent {
  @Input() titleVisible = true;

  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild('canvas', {static: true}) canvasChild;

  loadTask: BackgroundTask<MapLocator, [KnowledgeMap, ExtraResult]>;
  loadSubscription: Subscription;
  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  locator: MapLocator | undefined;
  returnUrl: string;

  hasEditPermission = false;
  _map: KnowledgeMap | undefined;
  pendingInitialize = false;
  infoPinned = true;

  graphCanvas: CanvasGraphView;

  historyChangesSubscription: Subscription;
  unsavedChangesSubscription: Subscription;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  entitySearchTerm = '';
  entitySearchList: UniversalGraphEntity[] = [];
  entitySearchListIdx = -1;

  constructor(
    readonly mapService: MapService,
    readonly snackBar: MatSnackBar,
    readonly modalService: NgbModal,
    readonly messageDialog: MessageDialog,
    readonly progressDialog: ProgressDialog,
    readonly ngZone: NgZone,
    readonly route: ActivatedRoute,
    readonly errorHandler: ErrorHandler,
    readonly workspaceManager: WorkspaceManager,
  ) {
    this.loadTask = new BackgroundTask((locator) => {
      return combineLatest([
        this.mapService.getMap(locator.projectName, locator.hashId).pipe(
          // tslint:disable-next-line: no-string-literal
          map(resp => resp['project'] as KnowledgeMap),
          // TODO: This line is from the existing code and should be properly typed
        ),
        this.getExtraSource(),
      ]).pipe(
        this.errorHandler.create(),
      );
    });

    this.loadSubscription = this.loadTask.results$.subscribe(({result: [result, extra], value}) => {
      this.map = result;
      this.handleExtra(extra);
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    this.paramsSubscription = this.route.params.subscribe(params => {
      this.locator = {
        projectName: params.project_name,
        hashId: params.hash_id,
      };

      this.loadTask.update(this.locator);
    });
  }

  getExtraSource(): Observable<ExtraResult> {
    return new BehaviorSubject(null);
  }

  handleExtra(data: ExtraResult) {
  }

  // ========================================
  // Angular events
  // ========================================

  ngAfterViewInit() {
    const style = new KnowledgeMapStyle();
    this.graphCanvas = new CanvasGraphView(this.canvasChild.nativeElement as HTMLCanvasElement, {
      nodeRenderStyle: style,
      edgeRenderStyle: style,
    });

    this.registerGraphBehaviors();

    this.graphCanvas.startParentFillResizeListener();
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startAnimationLoop();
    });

    this.historyChangesSubscription = this.graphCanvas.historyChanges$.subscribe(() => {
      this.unsavedChanges$.next(true);
    });

    this.unsavedChangesSubscription = this.unsavedChanges$.subscribe(value => {
      this.emitModuleProperties();
    });

    if (this.pendingInitialize) {
      this.initializeMap();
    }
  }

  @Input()
  set map(value: KnowledgeMap | undefined) {
    this._map = value;
    this.initializeMap();

    console.log(this._map);
    console.log(this.graphCanvas);
  }

  get map() {
    return this._map;
  }

  private initializeMap() {
    if (!this.map) {
      return;
    }

    if (!this.graphCanvas) {
      this.pendingInitialize = true;
      return;
    }

    this.graphCanvas.setGraph(this.map.graph);
    this.graphCanvas.zoomToFit(0);
    this.emitModuleProperties();
  }

  registerGraphBehaviors() {
    this.graphCanvas.behaviors.add('copy-keyboard-shortcut', new CopyKeyboardShortcut(this.graphCanvas), -100);
  }

  ngOnDestroy() {
    this.queryParamsSubscription.unsubscribe();
    this.historyChangesSubscription.unsubscribe();
    this.unsavedChangesSubscription.unsubscribe();
    this.graphCanvas.destroy();
  }

  shouldConfirmUnload() {
    return this.unsavedChanges$.getValue();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.map ? this.map.label : 'Map',
      fontAwesomeIcon: 'project-diagram',
      badge: this.unsavedChanges$.getValue() ? '*' : null,
    });
  }

  // ========================================
  // States
  // ========================================

  /**
   * Save the current representation of knowledge model
   */
  save() {
    this.map.graph = this.graphCanvas.getGraph();
    this.map.date_modified = new Date().toISOString();

    // Push to backend to save
    this.mapService.updateMap(this.locator.projectName, this.map)
      .pipe(this.errorHandler.create())
      .subscribe(() => {
        this.unsavedChanges$.next(false);
        this.emitModuleProperties();
        this.snackBar.open('Map saved.', null, {
          duration: 2000,
        });
      });
  }

  // ========================================
  // Download
  // ========================================

  /**
   * Asks for the format to download the map
   */
  download() {
    if (this.unsavedChanges$.getValue()) {
      this.messageDialog.display({
        title: 'Save Required',
        message: 'Please save your changes before exporting.',
        type: MessageType.Error,
      });
    } else {
      this.modalService.open(MapExportDialogComponent).result.then(format => {
        if (format === 'pdf') {
          this.downloadPDF();
        } else if (format === 'svg') {
          this.downloadSVG();
        } else if (format === 'png') {
          this.downloadPNG();
        } else {
          throw new Error('invalid format');
        }
      }, () => {
      });
    }
  }

  private requestDownload(project: () => Observable<any>, mimeType: string, extension: string) {
    if (this.unsavedChanges$.getValue()) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {
      const progressDialogRef = this.progressDialog.display({
        title: `Export`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Generating the requested export...',
        })),
      });

      project().pipe(
        tap(
          () => progressDialogRef.close(),
          () => progressDialogRef.close()),
        this.errorHandler.create(),
      ).subscribe(resp => {
        // It is necessary to create a new blob object with mime-type explicitly set
        // otherwise only Chrome works like it should
        const newBlob = new Blob([resp], {
          type: mimeType,
        });

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(newBlob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(newBlob);

        const link = document.createElement('a');
        link.href = data;
        link.download = this.map.label + extension;
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
      });
    }
  }

  /**
   * Saves and downloads the PDF version of the current map
   */
  downloadPDF() {
    this.requestDownload(
      () => this.mapService.generatePDF(this.locator.projectName, this.locator.hashId),
      'application/pdf',
      '.pdf',
    );
  }

  /**
   * Saves and downloads the SVG version of the current map
   */
  downloadSVG() {
    this.requestDownload(
      () => this.mapService.generateSVG(this.locator.projectName, this.locator.hashId),
      'application/svg',
      '.svg',
    );
  }

  /**
   * Saves and downloads the PNG version of the current map
   */
  downloadPNG() {
    this.requestDownload(
      () => this.mapService.generatePNG(this.locator.projectName, this.locator.hashId),
      'application/png',
      '.png',
    );
  }

  // ========================================
  // Template stuff
  // ========================================

  zoomToFit() {
    this.graphCanvas.zoomToFit();
  }

  undo() {
    this.graphCanvas.undo();
  }

  redo() {
    this.graphCanvas.redo();
  }

  goToReturnUrl() {
    if (this.shouldConfirmUnload()) {
      if (confirm('Leave editor? Changes you made may not be saved.')) {
        this.workspaceManager.navigateByUrl(this.returnUrl);
      }
    } else {
      this.workspaceManager.navigateByUrl(this.returnUrl);
    }
  }
}

export interface MapLocator {
  projectName: string;
  hashId: string;
}
