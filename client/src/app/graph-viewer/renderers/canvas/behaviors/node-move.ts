import * as d3 from 'd3';
import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GraphCanvasView } from '../graph-canvas-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';

export class MovableNode extends AbstractCanvasBehavior {
  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  private offsetBetweenNodeAndMouseInitialPosition: number[] = [0, 0];

  constructor(protected readonly graphView: GraphCanvasView) {
    super();
  }

  dragStart(): BehaviorResult {
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;
    const subject: GraphEntity | undefined = d3.event.subject;

    if (subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;

      // We need to store the offset between the mouse and the node, because when
      // we actually move the node, we need to move it relative to this offset
      this.offsetBetweenNodeAndMouseInitialPosition = [
        node.data.x - transform.invertX(mouseX),
        node.data.y - transform.invertY(mouseY),
      ];
    }

    return BehaviorResult.Continue;
  }

  drag(): BehaviorResult {
    // TODO: cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;
    const subject: GraphEntity | undefined = d3.event.subject;

    if (subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;
      node.data.x = transform.invertX(mouseX) + this.offsetBetweenNodeAndMouseInitialPosition[0];
      node.data.y = transform.invertY(mouseY) + this.offsetBetweenNodeAndMouseInitialPosition[1];
      this.graphView.nodePositionOverrideMap.set(node, [node.data.x, node.data.y]);
      this.graphView.invalidateNode(node);
      // TODO: Store this in history as ONE object
    }

    return BehaviorResult.Continue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
