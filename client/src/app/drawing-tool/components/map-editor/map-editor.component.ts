import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { cloneDeep } from 'lodash';

import { makeid } from '../../services';
import { KnowledgeMap, UniversalGraph, UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';
import { from, Observable, of, Subscription } from 'rxjs';
import { auditTime, switchMap } from 'rxjs/operators';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { GraphAction, GraphActionReceiver } from '../../../graph-viewer/actions/actions';
import { mergeDeep } from '../../../graph-viewer/utils/objects';
import { mapBlobToBuffer, mapBufferToJson, readBlobAsBuffer } from '../../../shared/utils/files';
import { MAP_MIMETYPE } from '../../../file-browser/models/filesystem-object';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../../../file-browser/components/dialog/object-edit-dialog.component';
import { CanvasGraphView } from '../../../graph-viewer/renderers/canvas/canvas-graph-view';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: [
    '../map.component.scss',
    './map-editor.component.scss',
  ],
})
export class MapEditorComponent extends MapViewComponent<UniversalGraph | undefined> implements OnInit, OnDestroy {
  @ViewChild('modalContainer', {static: false}) modalContainer: ElementRef;
  autoSaveDelay = 5000;
  autoSaveSubscription: Subscription;

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
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.autoSaveSubscription.unsubscribe();
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
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('paste-keyboard-shortcut', new PasteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shortcut', new HistoryKeyboardShortcuts(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('selection', new SelectableEntity(this.graphCanvas), 0);
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

  openEditDialog() {
    const target = cloneDeep(this.map);
    const dialogRef = this.modalService.open(ObjectEditDialogComponent);
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.accept = ((changes: ObjectEditDialogValue) => {
      this.graphCanvas.execute(new KnowledgeMapUpdate(
        'Update map properties',
        this.map, changes.objectChanges, Object.keys(changes.objectChanges).reduce((obj, key) => {
          obj[key] = this.map[key];
          return obj;
        }, {}),
      ));
      this.unsavedChanges$.next(true);
      return Promise.resolve();
    });
    return dialogRef.result;
  }

  openVersionRestoreDialog() {
    return this.filesystemObjectActions.openVersionRestoreDialog(this.map).then(version => {
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
    if (event.dataTransfer.types.includes('application/lifelike-node')) {
      event.preventDefault();
    }
  }

  drop(event: DragEvent) {
    event.preventDefault();
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
