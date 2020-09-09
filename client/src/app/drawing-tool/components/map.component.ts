import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { MapService } from '../services';
import { KnowledgeMap } from '../services/interfaces';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ModuleProperties } from '../../shared/modules';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { map } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { CopyKeyboardShortcut } from '../../graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut';
import { WorkspaceManager } from '../../shared/workspace-manager';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: [
    './map.component.scss',
  ],
})
export class MapComponent<ExtraResult = void> implements OnDestroy, AfterViewInit {
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild('canvas', {static: true}) canvasChild;

  loadTask: BackgroundTask<MapLocator, [KnowledgeMap, ExtraResult]>;
  loadSubscription: Subscription;

  _locator: MapLocator | undefined;
  _map: KnowledgeMap | undefined;
  pendingInitialize = false;

  graphCanvas: CanvasGraphView;

  historyChangesSubscription: Subscription;
  unsavedChangesSubscription: Subscription;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  constructor(
      readonly mapService: MapService,
      readonly snackBar: MatSnackBar,
      readonly modalService: NgbModal,
      readonly messageDialog: MessageDialog,
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
      ]);
    });

    this.loadSubscription = this.loadTask.results$.subscribe(({result: [result, extra], value}) => {
      this.map = result;
      this.handleExtra(extra);
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
  set locator(value: MapLocator | undefined) {
    this._locator = value;
    if (value != null) {
      this.loadTask.update(value);
    }
  }

  get locator() {
    return this._locator;
  }

  @Input()
  set map(value: KnowledgeMap | undefined) {
    this._map = value;
    this.initializeMap();
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
    this.historyChangesSubscription.unsubscribe();
    this.unsavedChangesSubscription.unsubscribe();
    this.graphCanvas.destroy();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.map ? this.map.label : 'Map',
      fontAwesomeIcon: 'project-diagram',
      badge: this.unsavedChanges$.getValue() ? '*' : null,
    });
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
}

export interface MapLocator {
  projectName: string;
  hashId: string;
}
