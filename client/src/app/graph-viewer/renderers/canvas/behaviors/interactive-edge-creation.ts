import * as d3 from 'd3';

import { GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { Arrowhead } from '../../../utils/canvas/line-heads/arrow';
import { EdgeCreation } from '../../../actions/edges';
import { PlacedNode } from '../../../styles/styles';
import { AbstractNodeHandleBehavior, Handle } from '../../../utils/behaviors/abstract-node-handle-behavior';
import { isAltOrOptionPressed } from '../../../../shared/utils';

const HANDLE_BEHAVIOR_KEY = '_interactive-edge-creation/handle';
const HELPER_BEHAVIOR_KEY = '_interactive-edge-creation/helper';

export class InteractiveEdgeCreation extends AbstractCanvasBehavior {
  /**
   * Subscription for when the selection changes.
   */
  private selectionChangeSubscription;

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  setup() {
    this.selectionChangeSubscription = this.graphView.selection.changeObservable.subscribe(
      ([newSelection, oldSelection]) => {
        if (newSelection.length === 1 && newSelection[0].type === GraphEntityType.Node) {
          this.graphView.behaviors.delete(HANDLE_BEHAVIOR_KEY);
          this.graphView.behaviors.add(HANDLE_BEHAVIOR_KEY,
            new ActiveEdgeCreationHandle(this.graphView, newSelection[0].entity as UniversalGraphNode), 100);
        } else {
          this.graphView.behaviors.delete(HANDLE_BEHAVIOR_KEY);
        }
      },
    );
  }

  click(event: MouseEvent): BehaviorResult {
    if (isAltOrOptionPressed(event)) {
      const subject = this.graphView.getEntityAtMouse();
      if (subject && subject.type === GraphEntityType.Node) {
        const node = subject.entity as UniversalGraphNode;
        this.graphView.behaviors.delete(HELPER_BEHAVIOR_KEY);
        this.graphView.behaviors.add(HELPER_BEHAVIOR_KEY, new ActiveEdgeCreationHelper(this.graphView, node), 10);
      }
    }
    return BehaviorResult.Continue;
  }
}

class ActiveEdgeCreationHandle extends AbstractNodeHandleBehavior<Handle> {
  protected topOffset = 0;
  protected leftOffset = 0;
  protected size = 20;

  constructor(graphView: CanvasGraphView,
              target: UniversalGraphNode) {
    super(graphView, target);
  }

  drawHandle(ctx: CanvasRenderingContext2D, transform: any, {minX, minY, maxX, maxY}: Handle) {
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;

    const nodeRadius = this.size / 2 * noZoomScale;
    const x = (maxX - minX) / 2 + minX;
    const y = (maxY - minY) / 2 + minY;
    ctx.moveTo(x, y);
    ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2B7CE9';
    ctx.stroke();
    ctx.fillStyle = '#97C2FC';
    ctx.fill();
  }

  protected activeDragStart(event: MouseEvent, graphX: number, graphY: number) {
    this.graphView.behaviors.delete(HELPER_BEHAVIOR_KEY);
    this.graphView.behaviors.add(HELPER_BEHAVIOR_KEY, new ActiveEdgeCreationHelper(this.graphView, this.target), 10);
  }

  getHandleBoundingBoxes(placedNode: PlacedNode): Handle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = this.size * noZoomScale;
    const halfSize = size / 2;
    const x = (bbox.maxX - bbox.minX) / 2 + bbox.minX;
    const y = bbox.minY;
    return [
      // Top left
      {
        minX: x - halfSize + this.leftOffset,
        minY: y - halfSize + this.topOffset,
        maxX: x + halfSize + this.leftOffset,
        maxY: y + halfSize + this.topOffset,
      },
    ];
  }
}

class ActiveEdgeCreationHelper extends AbstractCanvasBehavior {
  private to: {
    data: {
      x, y
    }
  } = null;

  constructor(private readonly graphView: CanvasGraphView,
              private readonly from: UniversalGraphNode) {
    super();
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    if (event.key === 'Escape' || event.key === 'Delete') {
      this.graphView.requestRender();
      return BehaviorResult.RemoveAndStop;
    } else {
      return BehaviorResult.Stop;
    }
  }

  click(event: MouseEvent): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse(); // TODO: Cache

    if (subject && subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;
      if (node !== this.from) {
        this.graphView.execute(new EdgeCreation('Create connection', {
          from: this.from.hash,
          to: node.hash,
          label: null,
        }));
        this.graphView.requestRender();
        return BehaviorResult.RemoveAndContinue;
      }
    } else {
      return BehaviorResult.RemoveAndContinue;
    }
  }

  doubleClick(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Stop;
  }

  mouseMove(event: MouseEvent): BehaviorResult {
    // TODO: Cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = this.graphView.transform.invertX(mouseX);
    const graphY = this.graphView.transform.invertY(mouseY);

    this.to = {
      data: {
        x: graphX,
        y: graphY,
      },
    };

    this.graphView.requestRender();
    return BehaviorResult.Continue;
  }

  drag(event: MouseEvent): BehaviorResult {
    return BehaviorResult.Stop;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
    const from = this.from;
    const to = this.to;

    if (to) {
      ctx.beginPath();
      const noZoomScale = 1 / transform.scale(1).k;
      const color = '#2B7CE9';
      const lineWidth = noZoomScale;

      // Draw arrow
      const arrow = new Arrowhead(16, {
        fillStyle: color,
        strokeStyle: null,
        lineWidth,
      });
      const drawnTerminator = arrow.draw(ctx, from.data.x, from.data.y, to.data.x, to.data.y);

      // Draw line
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.moveTo(from.data.x, from.data.y);
      ctx.lineTo(drawnTerminator.startX, drawnTerminator.startY);
      ctx.stroke();

      // Draw the 'o' node at the end of the line
      const nodeRadius = 6 * noZoomScale;
      const x = to.data.x;
      const y = to.data.y;
      ctx.moveTo(x, y);
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#2B7CE9';
      ctx.stroke();
      ctx.fillStyle = '#97C2FC';
      ctx.fill();
    }
  }
}
