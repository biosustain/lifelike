import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { cloneDeep } from 'lodash';

import { makeid } from '../../services';
import { KnowledgeMap, UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';
import { from, Observable, Subscription, throwError } from 'rxjs';
import { auditTime, catchError, switchMap } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { MapEditDialogComponent } from '../map-edit-dialog.component';
import { GraphAction, GraphActionReceiver } from '../../../graph-viewer/actions/actions';
import { mergeDeep } from '../../../graph-viewer/utils/objects';
import { MapVersionDialogComponent } from '../map-version-dialog.component';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: ['./map-editor.component.scss'],
})
export class MapEditorComponent extends MapViewComponent<KnowledgeMap> implements OnInit, OnDestroy {
  @ViewChild('modalContainer', {static: false}) modalContainer: ElementRef;
  autoSaveDelay = 5000;
  autoSaveSubscription: Subscription;
  connectionHintShown = false;

  ngOnInit() {
    this.autoSaveSubscription = this.unsavedChanges$.pipe(auditTime(this.autoSaveDelay)).subscribe(changed => {
      if (changed) {
        this.saveBackup();
      }
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.autoSaveSubscription.unsubscribe();
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
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('paste-keyboard-shortcut', new PasteKeyboardShortcut(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shortcut', new HistoryKeyboardShortcuts(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('selection', new SelectableEntity(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('resize-handles', new HandleResizable(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('edge-creation', new InteractiveEdgeCreation(this.graphCanvas), 100);
  }

  save() {
    super.save();
    this.mapService.deleteBackup(this.locator.projectName, this.locator.hashId).subscribe();
  }

  saveBackup() {
    if (this.map) {
      this.map.graph = this.graphCanvas.getGraph();
      this.map.date_modified = new Date().toISOString();
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
    dialogRef.result.then((newMap: KnowledgeMap) => {
      this.graphCanvas.setGraph(newMap.graph);
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

      if (!this.connectionHintShown) {
        this.snackBar.open('Double click a node to connect it to another node.', null, {
          duration: 3000,
        });
        this.connectionHintShown = true;
      }
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
