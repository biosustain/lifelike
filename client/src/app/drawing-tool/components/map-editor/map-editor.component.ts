import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

import { cloneDeep } from 'lodash';

import { KnowledgeMap, UniversalGraph, UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';
import { from, Observable, of, Subscription, throwError } from 'rxjs';
import { auditTime, catchError, finalize, switchMap } from 'rxjs/operators';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { GraphAction, GraphActionReceiver } from '../../../graph-viewer/actions/actions';
import { mergeDeep } from '../../../graph-viewer/utils/objects';
import { mapBlobToBuffer, mapBufferToJson, readBlobAsBuffer } from '../../../shared/utils/files';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../../../file-browser/components/dialog/object-edit-dialog.component';
import { CanvasGraphView } from '../../../graph-viewer/renderers/canvas/canvas-graph-view';
import { ObjectVersion } from '../../../file-browser/models/object-version';
import { LockError } from '../../../file-browser/services/filesystem.service';
import { ObjectLock } from '../../../file-browser/models/object-lock';
import { makeid } from '../../../shared/utils/identifiers';
import { MAP_MIMETYPE } from '../../providers/map.type-provider';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: [
    '../map.component.scss',
    './map-editor.component.scss',
  ],
})
export class MapEditorComponent extends MapViewComponent<UniversalGraph | undefined> implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('modalContainer', {static: false}) modalContainer: ElementRef;
  autoSaveDelay = 5000;
  autoSaveSubscription: Subscription;

  private readonly lockCheckTimeInterval = 1000 * 30;
  private readonly slowLockCheckTimeInterval = 1000 * 60 * 2;
  private readonly veryInactiveDuration = 1000 * 60 * 30;
  private readonly inactiveDuration = 1000 * 60 * 5;

  private lockIntervalId = null;
  private lockStartIntervalId = null;
  lockAcquired: boolean | undefined = null;
  locks: ObjectLock[] = [];
  private lastLockCheckTime = window.performance.now();
  private lastActivityTime = window.performance.now();

  dropTargeted = false;

  ngOnInit() {
    this.autoSaveSubscription = this.unsavedChanges$.pipe(auditTime(this.autoSaveDelay)).subscribe(changed => {
      if (changed) {
        this.saveBackup();
      }
    });

    this.ngZone.runOutsideAngular(() => {
      this.canvasChild.nativeElement.addEventListener('dragend', e => {
        this.dragEnd(e);
      });

      this.canvasChild.nativeElement.addEventListener('dragleave', e => {
        this.dragLeave(e);
      });

      this.canvasChild.nativeElement.addEventListener('dragover', e => {
        this.dragOver(e);
      });

      this.canvasChild.nativeElement.addEventListener('drop', e => {
        this.drop(e);
      });
    });

    this.startLockInterval();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    this.subscriptions.add(this.graphCanvas.historyChanges$.subscribe(() => {
      this.unsavedChanges$.next(true);
    }));
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.autoSaveSubscription.unsubscribe();

    this.clearLockInterval();
  }

  getExtraSource(): Observable<UniversalGraph | null> {
    return from([this.locator]).pipe(switchMap(
      locator => this.filesystemService.getBackupContent(locator)
        .pipe(
          switchMap(blob => blob
            ? of(blob).pipe(
              mapBlobToBuffer(),
              mapBufferToJson<UniversalGraph>(),
            )
            : of(null)),
          this.errorHandler.create(),
        ),
    ));
  }

  handleExtra(backup: UniversalGraph | null) {
    if (backup != null) {
      this.modalService.open(MapRestoreDialogComponent, {
        container: this.modalContainer.nativeElement,
      }).result.then(() => {
        this.graphCanvas.execute(new KnowledgeMapRestore(
          `Restore map to backup`,
          this.graphCanvas,
          backup,
          cloneDeep(this.graphCanvas.getGraph()),
        ));
      }, () => {
        this.filesystemService.deleteBackup(this.locator)
          .subscribe(); // Need to subscribe so it actually runs
      });
    }

    this.acquireLock();
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('paste-keyboard-shortcut', new PasteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shortcut', new HistoryKeyboardShortcuts(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('resize-handles', new HandleResizable(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('edge-creation', new InteractiveEdgeCreation(this.graphCanvas), 1);
  }

  save() {
    super.save();
    this.filesystemService.deleteBackup(this.locator)
      .subscribe(); // Need to subscribe so it actually runs
  }

  saveBackup(): Observable<any> {
    if (this.map) {
      const observable = this.filesystemService.putBackup({
        hashId: this.locator,
        contentValue: new Blob([JSON.stringify(this.graphCanvas.getGraph())], {
          type: MAP_MIMETYPE,
        }),
      });
      observable.subscribe(); // Need to subscribe so it actually runs
      return observable;
    }
  }

  restore(version: ObjectVersion) {
    readBlobAsBuffer(version.contentValue).pipe(
      mapBufferToJson<UniversalGraph>(),
      this.errorHandler.create(),
    ).subscribe(graph => {
      this.graphCanvas.execute(new KnowledgeMapRestore(
        `Restore map to '${version.hashId}'`,
        this.graphCanvas,
        graph,
        cloneDeep(this.graphCanvas.getGraph()),
      ));
    }, e => {
      // Data is corrupt
      // TODO: Prevent the user from editing or something so the user doesnt lose data?
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  dragEnd(event: DragEvent) {
    this.ngZone.run(() => {
      this.dropTargeted = false;
    });
  }

  dragLeave(event: DragEvent) {
    this.ngZone.run(() => {
      this.dropTargeted = false;
    });
  }

  dragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes('application/lifelike-node')) {
      event.dataTransfer.dropEffect = 'link';
      event.preventDefault();
      this.ngZone.run(() => {
        this.dropTargeted = true;
      });
    }
  }

  drop(event: DragEvent) {
    event.preventDefault();
    this.ngZone.run(() => {
      this.dropTargeted = false;
    });
    const data = event.dataTransfer.getData('application/lifelike-node');
    const node = JSON.parse(data) as UniversalGraphNode;
    const hoverPosition = this.graphCanvas.hoverPosition;
    if (hoverPosition != null) {
      this.graphCanvas.execute(new NodeCreation(
        `Create ${node.display_name} node`, {
          hash: makeid(),
          ...node,
          data: {
            ...node.data,
            x: hoverPosition.x,
            y: hoverPosition.y,
          },
        }, true,
      ));
    }
  }

  get lockCheckingActive(): boolean {
    return this.lockIntervalId != null || this.lockStartIntervalId != null;
  }

  acquireLock() {
    const monotonicNow = window.performance.now();

    if (monotonicNow - this.lastActivityTime > this.veryInactiveDuration) {
      // If the user is inactive for too long, stop hitting our poor server
      this.clearLockInterval();
    } else if (monotonicNow - this.lastActivityTime > this.inactiveDuration) {
      // If the user is inactive for a bit, let's slow down the checking interval
      if (monotonicNow - this.lastLockCheckTime < this.slowLockCheckTimeInterval) {
        return;
      }
    }

    if (this.lockAcquired === false) {
      this.filesystemService.getLocks(this.locator).pipe(
        this.errorHandler.create(),
      ).pipe(
        finalize(() => this.lastLockCheckTime = window.performance.now()),
      ).subscribe(locks => {
        this.ngZone.run(() => {
          this.locks = locks;
        });
      });
    } else {
      this.filesystemService.acquireLock(this.locator, {
        own: true,
      }).pipe(
        finalize(() => this.lastLockCheckTime = window.performance.now()),
        catchError(error => {
          if (!(error instanceof LockError)) {
            this.errorHandler.showError(error);
          }
          return throwError(error);
        }),
      ).subscribe(locks => {
        this.lockAcquired = true;
        this.ngZone.run(() => {
          this.locks = locks;
        });
      }, (err: LockError) => {
        this.lockAcquired = false;
        this.ngZone.run(() => {
          this.locks = err.locks;
        });
      });
    }
  }

  startLockInterval() {
    this.lockAcquired = null;

    // Make the timer start near the crossing of the second hand, to make it look like the
    // lock indication is live, even through we actually check infrequently
    this.lockStartIntervalId = setTimeout(() => {
      this.lockIntervalId = setInterval(this.acquireLock.bind(this), this.lockCheckTimeInterval);
    }, (60 - new Date().getSeconds() + 1));

    this.acquireLock();
  }

  clearLockInterval() {
    if (this.lockStartIntervalId != null) {
      clearInterval(this.lockStartIntervalId);
      this.lockStartIntervalId = null;
    }
    if (this.lockIntervalId != null) {
      clearInterval(this.lockIntervalId);
      this.lockIntervalId = null;
    }
  }

  reload() {
    const doReload = () => {
      this.clearLockInterval();
      this.loadTask.update(this.locator);
      this.startLockInterval();
    };
    if (this.unsavedChanges$.value) {
      if (confirm('You have unsaved changes. Are you sure that you want to reload?')) {
        doReload();
      }
    } else {
      doReload();
    }
  }

  @HostListener('window:mousemove', ['$event'])
  mouseMove(event: MouseEvent) {
    this.lastActivityTime = window.performance.now();
  }

  @HostListener('window:keydown', ['$event'])
  keyDown(event: MouseEvent) {
    this.lastActivityTime = window.performance.now();
  }
}

class KnowledgeMapUpdate implements GraphAction {
  constructor(public description: string,
              public map: KnowledgeMap,
              public updatedData: Partial<KnowledgeMap>,
              public originalData: Partial<KnowledgeMap>) {
  }

  apply(component: GraphActionReceiver) {
    mergeDeep(this.map, this.updatedData);
  }

  rollback(component: GraphActionReceiver) {
    mergeDeep(this.map, this.originalData);
  }
}


class KnowledgeMapRestore implements GraphAction {
  constructor(public description: string,
              public graphCanvas: CanvasGraphView,
              public updatedData: UniversalGraph,
              public originalData: UniversalGraph) {
  }

  apply(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.updatedData));
    this.graphCanvas.zoomToFit(0);
  }

  rollback(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.originalData));
    this.graphCanvas.zoomToFit(0);
  }
}
