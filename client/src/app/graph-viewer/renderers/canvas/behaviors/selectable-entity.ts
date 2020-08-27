import * as d3 from 'd3';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { GraphEntity } from '../../../../drawing-tool/services/interfaces';

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

  dragEnd(event: MouseEvent): BehaviorResult {
    const subject: GraphEntity | undefined = d3.event.subject;
    this.graphView.selection.replace(subject ? [subject] : []);
    this.graphView.dragging.replace([]);
    this.graphView.requestRender(); // TODO: Don't call unless needed
    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
