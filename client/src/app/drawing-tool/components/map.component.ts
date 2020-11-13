import { escapeRegExp } from 'lodash';
import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { MapService } from '../services';
import { GraphEntity, GraphEntityType, KnowledgeMap } from '../services/interfaces';
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
import { emptyIfNull } from '../../shared/utils/types';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';

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

  loadTask: BackgroundTask<string, [FilesystemObject, ExtraResult]>;
  loadSubscription: Subscription;

  _locator: string | undefined;
  _map: FilesystemObject | undefined;
  pendingInitialize = false;

  graphCanvas: CanvasGraphView;

  historyChangesSubscription: Subscription;
  unsavedChangesSubscription: Subscription;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  entitySearchTerm = '';
  entitySearchList: GraphEntity[] = [];
  entitySearchListIdx = -1;

  constructor(
      readonly filesystemService: FilesystemService,
      readonly snackBar: MatSnackBar,
      readonly modalService: NgbModal,
      readonly messageDialog: MessageDialog,
      readonly ngZone: NgZone,
      readonly route: ActivatedRoute,
      readonly errorHandler: ErrorHandler,
      readonly workspaceManager: WorkspaceManager,
  ) {
    this.loadTask = new BackgroundTask((hashId) => {
      return combineLatest([
        this.filesystemService.get(hashId, {
          loadContent: true,
        }),
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
  set locator(value: string | undefined) {
    this._locator = value;
    if (value != null) {
      this.loadTask.update(value);
    }
  }

  get locator() {
    return this._locator;
  }

  @Input()
  set map(value: FilesystemObject | undefined) {
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

    const reader = new FileReader();
    reader.onload = e => {
      // TODO: Handle corrupt map data
      const graph = JSON.parse(e.target.result as string);
      this.graphCanvas.setGraph(graph);
      this.graphCanvas.zoomToFit(0);
    };
    reader.readAsText(this.map.contentValue);
    this.emitModuleProperties();

    if (this.highlightTerms != null && this.highlightTerms.length) {
      this.graphCanvas.highlighting.replace(this.graphCanvas.findMatching(this.highlightTerms));
    }
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

  // ========================================
  // Search stuff
  // ========================================

  search() {
    if (this.entitySearchTerm.length) {
      this.entitySearchList = this.graphCanvas.findMatching(this.entitySearchTerm.split(/ +/g));
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
