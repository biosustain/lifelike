import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { CopyKeyboardShortcut } from 'app/graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { tokenizeQuery } from 'app/shared/utils/find';

import { MapService } from '../services';
import { GraphEntity, KnowledgeMap, UniversalGraphNode } from '../services/interfaces';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: [
    './map.component.scss',
  ],
})
export class MapComponent<ExtraResult = void> implements OnDestroy, AfterViewInit {
  @Input() highlightTerms: string[] | undefined;
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild('canvas', {static: true}) canvasChild;

  loadTask: BackgroundTask<MapLocator, [KnowledgeMap, ExtraResult]>;
  loadSubscription: Subscription;

  _locator: MapLocator | undefined;
  _map: KnowledgeMap | undefined;
  pendingInitialize = false;

  editable = true;
  graphCanvas: CanvasGraphView;

  protected readonly subscriptions = new Subscription();
  historyChangesSubscription: Subscription;
  unsavedChangesSubscription: Subscription;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  entitySearchTerm = '';
  entitySearchList: GraphEntity[] = [];
  entitySearchListIdx = -1;

  constructor(
      readonly mapService: MapService,
      readonly snackBar: MatSnackBar,
      readonly modalService: NgbModal,
      readonly messageDialog: MessageDialog,
      readonly ngZone: NgZone,
      readonly route: ActivatedRoute,
      readonly errorHandler: ErrorHandler,
      readonly workspaceManager: WorkspaceManager,
      readonly filesystemService: FilesystemService,
  ) {
    this.loadTask = new BackgroundTask((locator) => {
      return combineLatest([
        this.mapService.getMap(locator.projectName, locator.hashId).pipe(
            // tslint:disable-next-line: no-string-literal
            map(resp => {
              this.editable = resp.editable;
              return resp.project;
            }),
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
      this.search();
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

    if (this.highlightTerms != null && this.highlightTerms.length) {
      this.graphCanvas.highlighting.replace(
        this.graphCanvas.findMatching(this.highlightTerms, {keepSearchSpecialChars: true})
      );
    }
  }

  registerGraphBehaviors() {
    this.graphCanvas.behaviors.add('selection', new SelectableEntity(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('copy-keyboard-shortcut', new CopyKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), -10);
  }

  ngOnDestroy() {
    this.historyChangesSubscription.unsubscribe();
    this.unsavedChangesSubscription.unsubscribe();
    this.graphCanvas.destroy();
    this.subscriptions.unsubscribe();
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

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.map.label);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: this.map.label,
      label: 'map',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.locator.hashId + '',
        }],
        sources: [{
          domain: 'File Source',
          url: ['/projects', encodeURIComponent(this.locator.projectName),
            'maps', encodeURIComponent(this.locator.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  // ========================================
  // Search stuff
  // ========================================

  search() {
    if (this.entitySearchTerm.length) {
      this.entitySearchList = this.graphCanvas.findMatching(
        tokenizeQuery(this.entitySearchTerm, {
          singleTerm: true,
        }), {
        wholeWord: false,
      });
      this.entitySearchListIdx = -1;

      this.graphCanvas.searchHighlighting.replace(this.entitySearchList);
      this.graphCanvas.searchFocus.replace([]);
      this.graphCanvas.requestRender();

    } else {
      this.entitySearchList = [];
      this.entitySearchListIdx = -1;

      this.graphCanvas.searchHighlighting.replace([]);
      this.graphCanvas.searchFocus.replace([]);
      this.graphCanvas.requestRender();
    }
  }

  clearSearchQuery() {
    this.entitySearchTerm = '';
    this.search();
  }

  next() {
    // we need rule ...
    this.entitySearchListIdx++;
    if (this.entitySearchListIdx >= this.entitySearchList.length) {
      this.entitySearchListIdx = 0;
    }
    this.graphCanvas.panToEntity(
      this.entitySearchList[this.entitySearchListIdx] as GraphEntity
    );
  }

  previous() {
    // we need rule ..
    this.entitySearchListIdx--;
    if (this.entitySearchListIdx <= -1) {
      this.entitySearchListIdx = this.entitySearchList.length - 1;
    }
    this.graphCanvas.panToEntity(
      this.entitySearchList[this.entitySearchListIdx] as GraphEntity
    );
  }
}

export interface MapLocator {
  projectName: string;
  hashId: string;
}
