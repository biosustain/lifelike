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
import { BehaviorSubject, combineLatest, defer, Observable, of, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ModuleProperties } from 'app/shared/modules';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { tokenizeQuery } from 'app/shared/utils/find';
import { mapBlobToBuffer, mapBufferToJson, mapJsonToGraph } from 'app/shared/utils/files';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { SelectableEntityBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity.behavior'; // from below
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { CopyKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/copy-keyboard-shortcut.behavior';
import { MimeTypes } from 'app/shared/constants';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';

import { GraphEntity, KnowledgeMapGraph } from '../services/interfaces';
import { MapImageProviderService } from '../services/map-image-provider.service';
import { GraphActionsService } from '../services/graph-actions.service';
import { GraphViewDirective } from '../directives/graph-view.directive';

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  providers: [OpenFileProvider],
})
export class MapComponent<ExtraResult = void> implements OnDestroy, AfterViewInit, OnChanges {
  @Input() highlightTerms: string[] | undefined;
  @Output() saveStateListener: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @ViewChild(GraphViewDirective, { static: true }) graphCanvasDirective!: GraphViewDirective;

  get graphCanvas() {
    return this.graphCanvasDirective.canvasGraphView;
  }

  loadTask: BackgroundTask<string, [FilesystemObject, Blob, ExtraResult]> = new BackgroundTask(
    (hashId) =>
      combineLatest([
        this.filesystemService.open(hashId),
        this.filesystemService.getContent(hashId),
        this.getBackupBlob(),
      ])
  );
  loadSubscription: Subscription;

  _locator: string | undefined;
  @Input() map: FilesystemObject | undefined;
  @Input() contentValue: Blob | undefined;
  pendingInitialize = false;

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
    readonly graphActionsService: GraphActionsService,
    readonly openFileProvider: OpenFileProvider
  ) {
    const isInEditMode = this.isInEditMode.bind(this);

    this.loadSubscription = this.loadTask.results$.subscribe(
      ({ result: [mapFile, mapBlob, backupBlob], value }) => {
        this.map = mapFile;
        this.openFileProvider.object = mapFile;

        if (mapFile.new && mapFile.privileges.writable && !isInEditMode()) {
          this.workspaceManager.navigate([
            '/projects',
            encodeURIComponent(this.map.project.name),
            'maps',
            this.map.hashId,
            'edit',
          ]);
        }

        this.contentValue = mapBlob;
        this.initializeMap();
        this.handleBackupBlob(backupBlob);
      }
    );
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

  handleBackupBlob(data: ExtraResult) {}

  // ========================================
  // Angular events
  // ========================================

  ngAfterViewInit() {
    this.registerGraphBehaviors();

    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.startParentFillResizeListener();
      this.graphCanvas.startAnimationLoop();
    });

    this.historyChangesSubscription = this.graphCanvas.historyChanges$.subscribe(() => {
      this.search();
    });

    this.unsavedChangesSubscription = this.unsavedChanges$.subscribe((value) => {
      this.emitModuleProperties();
    });

    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('map' in changes || 'contentValue' in changes) {
      this.initializeMap();
    }
  }

  private isInEditMode() {
    const { path = '' } = this.route.snapshot.url[4] || {};
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
    this.ngZone.runOutsideAngular(() => {
      this.providerSubscription$ = this.openMap(this.contentValue, this.map).subscribe((graph) => {
        this.graphCanvas.initializeGraph(graph);
        this.graphCanvas.zoomToFit(0);

        if (this.highlightTerms != null && this.highlightTerms.length) {
          this.graphCanvas.highlighting.replace(
            this.graphCanvas.findMatching(this.highlightTerms, {
              keepSearchSpecialChars: true,
              wholeWord: true,
            })
          );
        }
      });
      });
    });
  }

  openMap(mapBlob: Blob, mapFile: FilesystemObject): Observable<KnowledgeMapGraph> {
    return this.objectTypeService.get(mapFile).pipe(
      switchMap((typeProvider) => typeProvider.unzipContent(mapBlob)),
      map((graphRepr) => new Blob([graphRepr], { type: MimeTypes.Map })),
      mapBlobToBuffer(),
      mapBufferToJson<KnowledgeMapGraph>(),
      mapJsonToGraph(),
      this.errorHandler.create({ label: 'Parse map data' }),
      catchError((e) => {
        // Data is corrupt
        // TODO: Prevent the user from editing or something so the user doesnt lose data?
        throw e;
      })
    );
  }

  registerGraphBehaviors() {
    this.graphCanvas.behaviors.add('selection', new SelectableEntityBehavior(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add(
      'copy-keyboard-shortcut',
      new CopyKeyboardShortcutBehavior(this.graphCanvas, this.snackBar),
      -100
    );
  }

  ngOnDestroy() {
    const { historyChangesSubscription, unsavedChangesSubscription } = this;
    if (historyChangesSubscription) {
      historyChangesSubscription.unsubscribe();
    }
    if (unsavedChangesSubscription) {
      unsavedChangesSubscription.unsubscribe();
    }
    this.subscriptions.unsubscribe();
    this.providerSubscription$.unsubscribe();
  }

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.map ? this.map.filename : 'Map',
      fontAwesomeIcon: 'project-diagram',
      badge: this.unsavedChanges$.getValue() ? '*' : null,
    });
  }

  // ========================================
  // Template stuff
  // ========================================

  zoomToFit() {
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.zoomToFit();
    });
  }

  undo() {
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.undo();
    });
  }

  redo() {
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.redo();
    });
  }

  // ========================================
  // Search stuff
  // ========================================

  search() {
    if (this.entitySearchTerm.length) {
      this.entitySearchList = this.graphCanvas.findMatching(
        tokenizeQuery(this.entitySearchTerm, {
          singleTerm: true,
        }),
        {
          wholeWord: false,
        }
      );
    } else {
      this.entitySearchList = [];
    }
    this.graphCanvas.searchHighlighting.replace(this.entitySearchList);
    this.entitySearchListIdx = -1;
    this.graphCanvas.searchFocus.replace([]);
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.requestRender();
    });
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
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.panToEntity(this.entitySearchList[this.entitySearchListIdx] as GraphEntity);
    });
  }

  previous() {
    // we need rule ..
    this.entitySearchListIdx--;
    if (this.entitySearchListIdx <= -1) {
      this.entitySearchListIdx = this.entitySearchList.length - 1;
    }
    this.ngZone.runOutsideAngular(() => {
      this.graphCanvas.panToEntity(this.entitySearchList[this.entitySearchListIdx] as GraphEntity);
    });
  }
}
