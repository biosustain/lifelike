import { GraphCanvasView } from '../graph-canvas-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';

export class SelectableEntity extends AbstractCanvasBehavior {
  constructor(private readonly graphView: GraphCanvasView) {
    super();
  }

  click(): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse(); // TODO: Cache
    this.graphView.selection.replace(subject ? [subject] : []);
    this.graphView.requestRender(); // TODO: Don't call unless needed
    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
