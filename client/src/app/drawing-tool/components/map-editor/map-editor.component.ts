import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  NgZone,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { cloneDeep } from 'lodash-es';
import { forkJoin, from, Observable, of, Subscription } from 'rxjs';
import { auditTime, defaultIfEmpty, map, switchMap, tap } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { InteractiveEdgeCreationBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation.behavior';
import { HandleResizableBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable.behavior';
import { GraphAction, GraphActionReceiver } from 'app/graph-viewer/actions/actions';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { MimeTypes } from 'app/shared/constants';
import { DeleteKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut.behavior';
import { PasteKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut.behavior';
import { HistoryKeyboardShortcutsBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts.behavior';
import { ImageUploadBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/image-upload.behavior';
import { GroupCreation, GroupExtension } from 'app/graph-viewer/actions/groups';
import { MovableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/entity-move.behavior';
import { DuplicateKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/duplicate-keyboard-shortcut.behavior';
import { isCtrlOrMetaPressed } from 'app/shared/DOMutils';
import { ModuleContext } from 'app/shared/services/module-context.service';
import { ShouldConfirmUnload } from 'app/shared/modules';
import { ImageBlob } from 'app/shared/utils/forms';
import { createGroupNode } from 'app/graph-viewer/utils/objects';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { GraphActionsService } from 'app/drawing-tool/services/graph-actions.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { MapImageProviderService } from 'app/drawing-tool/services/map-image-provider.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { OpenFileProvider } from 'app/shared/providers/open-file/open-file.provider';

import {
  GraphEntityType,
  UniversalGraphGroup,
  KnowledgeMapGraph,
  UniversalGraphNode,
} from '../../services/interfaces';
import { MapViewComponent } from '../map-view.component';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { InfoPanel } from '../../models/info-panel';
import { LockService } from './lock.service';
import { EventManagerService } from '../../services/event-manager.service';
import { MapStoreService } from '../../services/map-store.service';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: ['../map.component.scss', './map-editor.component.scss'],
  providers: [
    ModuleContext,
    LockService,
    OpenFileProvider,
    EventManagerService, // defining here let's grab MapView elementRef in service
    MapStoreService,
  ],
})
export class MapEditorComponent
  extends MapViewComponent<Blob | undefined>
  implements OnInit, OnDestroy, AfterViewInit, ShouldConfirmUnload
{
  @ViewChild('infoPanelSidebar', { static: false }) infoPanelSidebarElementRef: ElementRef;
  @ViewChild('modalContainer', { static: false }) modalContainer: ElementRef;

  constructor(
    filesystemService: FilesystemService,
    objectTypeService: ObjectTypeService,
    snackBar: MatSnackBar,
    modalService: NgbModal,
    messageDialog: MessageDialog,
    ngZone: NgZone,
    route: ActivatedRoute,
    errorHandler: ErrorHandler,
    workspaceManager: WorkspaceManager,
    filesystemObjectActions: FilesystemObjectActions,
    dataTransferDataService: DataTransferDataService,
    mapImageProviderService: MapImageProviderService,
    graphActionsService: GraphActionsService,
    progressDialog: ProgressDialog,
    openFileProvider: OpenFileProvider,
    moduleContext: ModuleContext,
    readonly lockService: LockService
  ) {
    super(
      filesystemService,
      objectTypeService,
      snackBar,
      modalService,
      messageDialog,
      ngZone,
      route,
      errorHandler,
      workspaceManager,
      filesystemObjectActions,
      dataTransferDataService,
      mapImageProviderService,
      graphActionsService,
      progressDialog,
      openFileProvider,
      moduleContext
    );
    // Set it after parent constructor finished
    this.lockService.locator = this.locator;
  }

  autoSaveDelay = 5000;
  autoSaveSubscription: Subscription;

  reloadPopupDismissed = false;
  infoPanel = new InfoPanel();
  activeTab: string;

  dropTargeted = false;

  providerSubscription$ = new Subscription();

  set locator(value) {
    // Unless called from parent constructor context it is defined
    if (this.lockService) {
      this.lockService.locator = value;
    }
    super.locator = value;
  }

  get locator() {
    return super.locator;
  }

  private focusSidebar() {
    // Focus the input on the sidebar
    setTimeout(() => {
      const initialFocusElement = this.infoPanelSidebarElementRef.nativeElement.querySelector(
        '.map-editor-initial-focus'
      );
      if (initialFocusElement) {
        initialFocusElement.focus();
        initialFocusElement.select();
      }
    }, 100);
  }

  ngOnInit() {
    this.autoSaveSubscription = this.unsavedChanges$
      .pipe(auditTime(this.autoSaveDelay))
      .subscribe((changed) => {
        if (changed) {
          this.saveBackup().subscribe();
        }
      });

    this.lockService.startLockInterval();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    this.subscriptions.add(
      this.graphCanvas.historyChanges$.subscribe(() => {
        this.unsavedChanges$.next(true);
      })
    );
    this.subscriptions.add(
      this.graphCanvas.editorPanelFocus$.subscribe(() => {
        this.focusSidebar();
      })
    );
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.providerSubscription$.unsubscribe();
    this.autoSaveSubscription.unsubscribe();
  }

  getBackupBlob(): Observable<Blob | null> {
    return from([this.locator]).pipe(
      switchMap((locator) =>
        this.filesystemService.getBackupContent(locator).pipe(
          switchMap((blob) => (blob ? of(blob) : of(null))),
          this.errorHandler.create({ label: 'Load map backup' })
        )
      )
    );
  }

  handleBackupBlob(backup: Blob | null) {
    if (backup != null) {
      this.modalService
        .open(MapRestoreDialogComponent, {
          container: this.modalContainer.nativeElement,
        })
        .result.then(
          async () => {
            this.openMap(backup, this.map).subscribe((graph) => {
              this.graphCanvas.execute(
                new KnowledgeMapRestore(
                  `Restore map to backup`,
                  this.graphCanvas,
                  graph,
                  cloneDeep(this.graphCanvas.getGraph())
                )
              );
            });
          },
          () => {
            this.filesystemService.deleteBackup(this.locator).subscribe(); // Need to subscribe so it actually runs
          }
        );
    }

    this.lockService.acquireLock();
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add(
      'delete-keyboard-shortcut',
      new DeleteKeyboardShortcutBehavior(this.graphCanvas),
      -100
    );
    this.graphCanvas.behaviors.add(
      'duplicate-keyboard-shortcut',
      new DuplicateKeyboardShortcutBehavior(this.graphCanvas),
      -100
    );
    this.graphCanvas.behaviors.add(
      'paste-keyboard-shortcut',
      new PasteKeyboardShortcutBehavior(this.graphCanvas, this.dataTransferDataService),
      -100
    );
    this.graphCanvas.behaviors.add(
      'image-upload',
      new ImageUploadBehavior(this.graphCanvas, this.mapImageProviderService, this.snackBar),
      -100
    );
    this.graphCanvas.behaviors.add(
      'history-keyboard-shortcut',
      new HistoryKeyboardShortcutsBehavior(this.graphCanvas, this.snackBar),
      -100
    );
    this.graphCanvas.behaviors.add('moving', new MovableEntity(this.graphCanvas), -10); // from below
    this.graphCanvas.behaviors.add(
      'resize-handles',
      new HandleResizableBehavior(this.graphCanvas),
      0
    );
    this.graphCanvas.behaviors.add(
      'edge-creation',
      new InteractiveEdgeCreationBehavior(this.graphCanvas),
      1
    );
    // Disabling this for now, since this is redundant with the canvasChild event listeners setup above. Those callbacks seem to be the
    // preferred ones for drag-and-drop.
    // this.graphCanvas.behaviors.add('drag-drop-entity', new DragDropEntityBehavior(this.graphCanvas), 1);
  }

  save() {
    super.save();
    this.filesystemService.deleteBackup(this.locator).subscribe(); // Need to subscribe so it actually runs
  }

  saveBackup(): Observable<{}> {
    if (this.map) {
      return forkJoin(
        this.graphCanvas?.getImageChanges().newImageHashes.map((hash) =>
          this.mapImageProviderService.getBlob(hash).pipe(
            map((blob) => ({
              blob,
              filename: hash,
            })),
            tap((imageHash) => console.log(imageHash))
          )
        )
      ).pipe(
        defaultIfEmpty([]),
        switchMap((newImages: ImageBlob[]) =>
          this.filesystemService.putBackup({
            hashId: this.locator,
            contentValue: new Blob([JSON.stringify(this.graphCanvas.getExportableGraph())], {
              type: MimeTypes.Map,
            }),
            newImages,
          })
        )
      );
    }
  }

  restore(version: ObjectVersion) {
    this.providerSubscription$ = this.openMap(
      version.contentValue,
      version.originalObject
    ).subscribe((graph) => {
      this.graphCanvas.execute(
        new KnowledgeMapRestore(
          `Restore map to '${version.hashId}'`,
          this.graphCanvas,
          graph,
          cloneDeep(this.graphCanvas.getGraph())
        )
      );
    });
  }

  /**
   * Checks if current selection allows to create a group. For that, we need at least 2 nodes.
   */
  canCreateGroupFromSelection() {
    const selection = this.graphCanvas?.selection.get();
    if (selection) {
      return (
        selection.filter((entity) => entity.type === GraphEntityType.Node).length > 1 &&
        !selection.find((entity) => entity.type === GraphEntityType.Group)
      );
    }
    return false;
  }

  canExtendsGroupFromSelection() {
    const selection = this.graphCanvas?.selection.get();
    if (selection) {
      return (
        selection.filter((entity) => entity.type === GraphEntityType.Node).length > 0 &&
        selection.filter((entity) => entity.type === GraphEntityType.Group).length === 1
      );
    }
    return false;
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent) {
    return Promise.resolve(this.shouldConfirmUnload).then((shouldConfirmUnload) => {
      if (shouldConfirmUnload) {
        event.returnValue = 'Leave page? Changes you made may not be saved';
      }
    });
  }

  reload() {
    const doReload = () => {
      this.lockService.clearLockInterval();
      this.loadTask.update(this.locator);
      this.lockService.startLockInterval();
    };
    if (this.unsavedChanges$.value) {
      if (confirm('You have unsaved changes. Are you sure that you want to reload?')) {
        doReload();
      }
    } else {
      doReload();
    }
  }

  dismissReloadPopup() {
    this.reloadPopupDismissed = true;
  }

  @HostListener('window:keydown', ['$event'])
  keyDown(event: KeyboardEvent) {
    if (isCtrlOrMetaPressed(event) && event.key === 's') {
      this.save();
      event.preventDefault();
    }
  }

  createGroup() {
    const { graphCanvas } = this;
    if (graphCanvas) {
      const { selection } = graphCanvas;
      const members = selection
        .get()
        .reduce(
          (r, { type, entity }) => (type === GraphEntityType.Node ? r.concat(entity) : r),
          [] as UniversalGraphNode[]
        );
      selection.replace([]);
      graphCanvas.execute(
        new GroupCreation(
          'Create group',
          createGroupNode({
            members,
          }),
          true,
          true
        )
      );
    }
  }

  addToGroup() {
    const selection = this.graphCanvas?.selection.get();
    // TODO: Error on 0 or 2?
    const group = selection.filter((entity) => entity.type === GraphEntityType.Group).pop()
      .entity as UniversalGraphGroup;

    const potentialMembers = selection.flatMap((entity) =>
      entity.type === GraphEntityType.Node ? [entity.entity as UniversalGraphNode] : []
    );
    // No duplicates
    const newMembers = potentialMembers.filter((node) => !group.members.includes(node));
    this.graphCanvas?.execute(new GroupExtension('Add new members to group', group, newMembers));
  }
}

class KnowledgeMapRestore implements GraphAction {
  constructor(
    public description: string,
    public graphCanvas: CanvasGraphView,
    public updatedData: KnowledgeMapGraph,
    public originalData: KnowledgeMapGraph
  ) {}

  apply(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.updatedData));
    this.graphCanvas.zoomToFit(0);
    this.graphCanvas.selection.replace([]);
  }

  rollback(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.originalData));
    this.graphCanvas.zoomToFit(0);
    this.graphCanvas.selection.replace([]);
  }
}
