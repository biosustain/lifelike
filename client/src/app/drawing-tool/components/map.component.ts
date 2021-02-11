import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { GraphEntity, UniversalGraph } from '../services/interfaces';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ModuleProperties } from '../../shared/modules';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { CopyKeyboardShortcut } from '../../graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { tokenizeQuery } from '../../shared/utils/find';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { mapBlobToBuffer, mapBufferToJson } from '../../shared/utils/files';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { SelectableEntity } from '../../graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { MovableNode } from '../../graph-viewer/renderers/canvas/behaviors/node-move';

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

  protected readonly subscriptions = new Subscription();
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
    readonly filesystemObjectActions: FilesystemObjectActions,
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
    Promise.resolve().then(() => {
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
    });
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

  get map(): FilesystemObject {
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

    this.emitModuleProperties();

    this.subscriptions.add(this.map.contentValue$.pipe(
      mapBlobToBuffer(),
      mapBufferToJson<UniversalGraph>(),
      this.errorHandler.create({label: 'Parse map data'}),
    ).subscribe(graph => {
      this.graphCanvas.setGraph(graph);
      this.graphCanvas.zoomToFit(0);

      if (this.highlightTerms != null && this.highlightTerms.length) {
        this.graphCanvas.highlighting.replace(
          this.graphCanvas.findMatching(this.highlightTerms, {keepSearchSpecialChars: true}),
        );
      }
    }, e => {
      // Data is corrupt
      // TODO: Prevent the user from editing or something so the user doesnt lose data?
    }));
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
    this.map.addDataTransferData(dataTransfer);
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
      this.entitySearchList[this.entitySearchListIdx] as GraphEntity,
    );
  }

  previous() {
    // we need rule ..
    this.entitySearchListIdx--;
    if (this.entitySearchListIdx <= -1) {
      this.entitySearchListIdx = this.entitySearchList.length - 1;
    }
    this.graphCanvas.panToEntity(
      this.entitySearchList[this.entitySearchListIdx] as GraphEntity,
    );
  }
}
