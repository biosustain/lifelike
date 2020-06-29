import {
  Component,
  HostListener,
} from '@angular/core';

import { makeid } from '../../services';
import { UniversalGraphNode } from '../../services/interfaces';

import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move';
import { SelectableEntity } from 'app/graph-viewer/renderers/canvas/behaviors/selectable-entity';
import { InteractiveEdgeCreation } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation';
import { HandleResizable } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable';
import { DeleteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut';
import { PasteKeyboardShortcut } from '../../../graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut';
import { HistoryKeyboardShortcuts } from '../../../graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts';
import { MapViewComponent } from '../map-view.component';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: ['./map-editor.component.scss'],
})
export class MapEditorComponent extends MapViewComponent {
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
