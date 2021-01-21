import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { cloneDeep } from 'lodash';

import { makeid } from '../../services';
import { KnowledgeMap, UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';
import { from, Observable, Subscription, throwError } from 'rxjs';
import { auditTime, catchError, finalize, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { MapEditDialogComponent } from '../map-edit-dialog.component';
import { GraphAction, GraphActionReceiver } from '../../../graph-viewer/actions/actions';
import { mergeDeep } from '../../../graph-viewer/utils/objects';
import { MapVersionDialogComponent } from '../map-version-dialog.component';
import { ObjectLock } from '../../../file-browser/models/object-lock';
import { LockError } from '../../../file-browser/services/filesystem.service';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: [
    '../map.component.scss',
    './map-editor.component.scss',
  ],
})
export class MapEditorComponent extends MapViewComponent<KnowledgeMap> implements OnInit, OnDestroy {
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

  ngOnInit() {
    this.autoSaveSubscription = this.unsavedChanges$.pipe(auditTime(this.autoSaveDelay)).subscribe(changed => {
      if (changed) {
        this.saveBackup();
      }
    });

    this.ngZone.runOutsideAngular(() => {
      this.canvasChild.nativeElement.addEventListener('dragover', e => {
        this.dragOver(e);
      });

      this.canvasChild.nativeElement.addEventListener('drop', e => {
        this.drop(e);
      });
    });

    this.startLockInterval();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.autoSaveSubscription.unsubscribe();

    this.clearLockInterval();
  }

  getExtraSource(): Observable<KnowledgeMap> {
    return from([this.locator]).pipe(switchMap(locator => {
      return this.mapService.getBackup(locator.projectName, locator.hashId).pipe(catchError(error => {
        if (error instanceof HttpErrorResponse) {
          const res = error as HttpErrorResponse;
          if (res.status === 404) {
            return from([null]);
          }
        }
        return throwError(error);
      }));
    }));
  }

  handleExtra(backup: KnowledgeMap) {
    if (backup != null) {
      this.modalService.open(MapRestoreDialogComponent, {
        container: this.modalContainer.nativeElement,
      }).result.then(() => {
        this.map = backup;
        this.unsavedChanges$.next(true);
      }, () => {
        this.mapService.deleteBackup(this.locator.projectName, this.locator.hashId).subscribe();
      });
    }

    this.acquireLock();
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('paste-keyboard-shortcut', new PasteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shortcut', new HistoryKeyboardShortcuts(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), -10);
    this.graphCanvas.behaviors.add('resize-handles', new HandleResizable(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('edge-creation', new InteractiveEdgeCreation(this.graphCanvas), 1);
  }

  save() {
    super.save();
    this.mapService.deleteBackup(this.locator.projectName, this.locator.hashId).subscribe();
  }

  saveBackup() {
    if (this.map) {
      this.map.graph = this.graphCanvas.getGraph();
      this.map.modified_date = new Date().toISOString();
      const observable = this.mapService.createOrUpdateBackup(this.locator.projectName, cloneDeep(this.map));
      observable.subscribe();
      return observable;
    }
  }

  displayEditDialog() {
    const dialogRef = this.modalService.open(MapEditDialogComponent);
    dialogRef.componentInstance.map = cloneDeep(this.map);
    dialogRef.result.then((newMap: KnowledgeMap) => {
      this.graphCanvas.execute(new KnowledgeMapUpdate(
        'Update map properties',
        this.map, {
          label: newMap.label,
          description: newMap.description,
          public: newMap.public,
        }, {
          label: this.map.label,
          description: this.map.description,
          public: this.map.public,
        },
      ));
      this.unsavedChanges$.next(true);
    }, () => {
    });
  }

  mapVersionDialog() {
    const dialogRef = this.modalService.open(MapVersionDialogComponent);
    dialogRef.componentInstance.map = cloneDeep(this.map);
    dialogRef.componentInstance.projectName = this.locator.projectName;
    dialogRef.result.then((newMap: Observable<{ version: KnowledgeMap }>) => {
      newMap.subscribe(result => {
        this.graphCanvas.setGraph(result.version.graph);
        this.snackBar.open('Map reverted to Version from ' + result.version.modified_date, null, {
          duration: 3000,
        });
      });
    }, () => {
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  dragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes('application/***ARANGO_DB_NAME***-node')) {
      event.preventDefault();
    }
  }

  drop(event: DragEvent) {
    event.preventDefault();
    const data = event.dataTransfer.getData('application/***ARANGO_DB_NAME***-node');
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
      this.filesystemService.getLocks(this.locator.hashId).pipe(
        this.errorHandler.create({label: 'Acquire file lock'}),
      ).pipe(
        finalize(() => this.lastLockCheckTime = window.performance.now()),
      ).subscribe(locks => {
        this.ngZone.run(() => {
          this.locks = locks;
        });
      });
    } else {
      this.filesystemService.acquireLock(this.locator.hashId, {
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
