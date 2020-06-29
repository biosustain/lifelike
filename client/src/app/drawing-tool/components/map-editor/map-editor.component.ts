import {
  Component,
  HostListener, OnInit,
} from '@angular/core';

import { cloneDeep } from 'lodash';

import { makeid } from '../../services';
import { Project, UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';
import { asyncScheduler, from, Observable, throwError } from 'rxjs';
import { catchError, switchMap, throttleTime } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: ['./map-editor.component.scss'],
})
export class MapEditorComponent extends MapViewComponent<Project> implements OnInit {
  autoSaveDelay = 5000;

  ngOnInit() {
    super.ngOnInit();

    this.unsavedChangesSubscription = this.unsavedChanges$.pipe(throttleTime(this.autoSaveDelay, asyncScheduler, {
      leading: false,
      trailing: true,
    })).subscribe(() => {
      this.saveBackup();
    });
  }

  getExtraSource(): Observable<Project> {
    return from([this.mapHashId]).pipe(switchMap(id => {
      return this.projectService.downloadProjectBackup(id).pipe(catchError(error => {
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

  handleExtra(backup: Project) {
    this.modalService.open(MapRestoreDialogComponent).result.then(() => {
      this.map = backup;
      this.unsavedChanges$.next(true);
    }, () => {
      this.projectService.deleteProjectBackup(backup.hash_id).subscribe();
    });
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

  saveBackup() {
    const backup = cloneDeep(this.map);
    backup.date_modified = (new Date()).toISOString();
    const observable = this.projectService.uploadProjectBackup(backup);
    observable.subscribe();
    return observable;
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
        },
      ));
    }
  }
}
