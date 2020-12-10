import * as d3 from 'd3';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult, DragBehaviorEvent } from '../../behaviors';
import { GraphEntity, UniversalGraphNode } from '../../../../drawing-tool/services/interfaces';
import { isCtrlOrMetaPressed, isShiftPressed } from '../../../../shared/utils';

export class SelectableEntity extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  click(event: MouseEvent): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse();
    if (subject == null) {
      this.graphView.selection.replace([]);
      this.graphView.requestRender(); // TODO: Don't call unless needed
    }
    return BehaviorResult.Continue;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    const subject = event.entity;
    if (isCtrlOrMetaPressed(event.event) || isShiftPressed(event.event)) {
      if (subject != null) {
        const selection = [...this.graphView.selection.get()];
        let found = false;
        for (let i = 0; i < selection.length; i++) {
          if (selection[i].entity === subject.entity) {
            found = true;
            selection.splice(i, 1);
            break;
          }
        }
        if (!found) {
          selection.push(subject);
        }
        this.graphView.selection.replace(selection);
        this.graphView.dragging.replace(selection);
        this.graphView.invalidateEntity(subject);
      }
    } else {
      this.graphView.selection.replace(subject ? [subject] : []);
      this.graphView.dragging.replace(subject ? [subject] : []);
      if (subject != null) {
        this.graphView.invalidateEntity(subject);
      }
    }
    this.graphView.requestRender(); // TODO: Don't call unless needed
    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
