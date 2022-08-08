import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, combineLatest, Observable, Subscription, of, defer } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ModuleProperties } from 'app/shared/modules';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { tokenizeQuery } from 'app/shared/utils/find';
import { mapBufferToJson, readBlobAsBuffer, mapJsonToGraph } from 'app/shared/utils/files';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { SelectableEntityBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity.behavior'; // from below
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { DelegateResourceManager } from 'app/graph-viewer/utils/resource/resource-manager';
import { CopyKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut.behavior';
import { MimeTypes } from 'app/shared/constants';

import { GraphEntity, KnowledgeMapGraph } from '../services/interfaces';
import { MapImageProviderService } from '../services/map-image-provider.service';
import { GraphActionsService } from '../services/graph-actions.service';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: [
    './map.component.scss',
  ],
})
export class MapComponent<ExtraResult = void> implements OnDestroy, AfterViewInit, OnChanges {
  @Input() highlightTerms: string[] | undefined;
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild('canvas', {static: true}) canvasChild;

  loadTask: BackgroundTask<string, [FilesystemObject, Blob, ExtraResult]>;
  loadSubscription: Subscription;

  _locator: string | undefined;
  @Input() map: FilesystemObject | undefined;
  @Input() contentValue: Blob | undefined;
  pendingInitialize = false;

  graphCanvas: CanvasGraphView;

  protected readonly subscriptions = new Subscription();
  historyChangesSubscription: Subscription;
  unsavedChangesSubscription: Subscription;
  providerSubscription$ = new Subscription();

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
    readonly dataTransferDataService: DataTransferDataService,
    readonly mapImageProviderService: MapImageProviderService,
    readonly objectTypeService: ObjectTypeService,
    readonly graphActionsService: GraphActionsService
  ) {
    this.loadTask = new BackgroundTask((hashId) => {
      return combineLatest([
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId),
        this.getBackupBlob(),
      ]);
    });
    const isInEditMode = this.isInEditMode.bind(this);

    this.loadSubscription = this.loadTask.results$.subscribe(({result: [mapFile, mapBlob, backupBlob], value}) => {
      this.map = mapFile;

      if (mapFile.new && mapFile.privileges.writable && !isInEditMode()) {
        this.workspaceManager.navigate(['/projects', this.map.project.name, 'maps', this.map.hashId, 'edit']);
      }

      this.contentValue = mapBlob;
      this.initializeMap();
      this.handleBackupBlob(backupBlob);
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


  dragTitleData$ = defer(() => of(this.map.getTransferData()));

  getBackupBlob(): Observable<ExtraResult> {
    return new BehaviorSubject(null);
  }

  handleBackupBlob(data: ExtraResult) {
  }

  // ========================================
  // Angular events
  // ========================================

  ngAfterViewInit() {
    Promise.resolve().then(() => {
      const style = new KnowledgeMapStyle(new DelegateResourceManager(this.mapImageProviderService)); // from below
      this.graphCanvas = new CanvasGraphView(this.canvasChild.nativeElement as HTMLCanvasElement, {
        nodeRenderStyle: style,
        edgeRenderStyle: style,
        groupRenderStyle: style,
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

      this.initializeMap();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('map' in changes || 'contentValue' in changes) {
      this.initializeMap();
    }
  }

  private isInEditMode() {
    const {path = ''} = this.route.snapshot.url[4] || {};
    return path === 'edit';
  }

  private initializeMap() {
    if (!this.map || !this.contentValue) {
      return;
    }

    if (!this.graphCanvas) {
      this.pendingInitialize = true;
      return;
    }

    this.emitModuleProperties();
    this.providerSubscription$ = this.openMap(this.contentValue, this.map).subscribe(
      graph => {
        this.graphCanvas.initializeGraph(graph);
        this.graphCanvas.zoomToFit(0);

        if (this.highlightTerms != null && this.highlightTerms.length) {
          this.graphCanvas.highlighting.replace(
            this.graphCanvas.findMatching(this.highlightTerms, {keepSearchSpecialChars: true, wholeWord: true}),
          );
        }
    });
  }

  openMap(mapBlob: Blob, mapFile: FilesystemObject): Observable<KnowledgeMapGraph> {
    return this.objectTypeService.get(mapFile).pipe(
      switchMap(typeProvider => typeProvider.unzipContent(mapBlob)),
      switchMap(graphRepr =>
        readBlobAsBuffer(new Blob([graphRepr], {type: MimeTypes.Map})).pipe(
          mapBufferToJson<KnowledgeMapGraph>(),
          mapJsonToGraph(),
          this.errorHandler.create({label: 'Parse map data'}),
        )
      ),
      catchError(e => {
        // Data is corrupt
        // TODO: Prevent the user from editing or something so the user doesnt lose data?
        throw e;
      })
    );
  }

  registerGraphBehaviors() {
    this.graphCanvas.behaviors.add('selection', new SelectableEntityBehavior(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('copy-keyboard-shortcut', new CopyKeyboardShortcutBehavior(this.graphCanvas, this.snackBar), -100);
  }

  ngOnDestroy() {
    const {historyChangesSubscription, unsavedChangesSubscription} = this;
    if (historyChangesSubscription) {
      historyChangesSubscription.unsubscribe();
    }
    if (unsavedChangesSubscription) {
      unsavedChangesSubscription.unsubscribe();
    }
    this.graphCanvas.destroy();
    this.subscriptions.unsubscribe();
    this.providerSubscription$.unsubscribe();
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
