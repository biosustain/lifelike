import * as d3 from 'd3';

import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { Arrowhead } from '../../../utils/canvas/line-heads/arrow';
import { EdgeCreation } from '../../../actions/edges';

const HELPER_BEHAVIOR_KEY = '_interactive-edge-creation/helper';

export class InteractiveEdgeCreation extends AbstractCanvasBehavior {
  private readonly DISTANCE_MOVE_THRESHOLD = 5;
  private dragFrom: { x: number, y: number };

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  dragStart(event: MouseEvent): BehaviorResult {
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    this.dragFrom = {x: mouseX, y: mouseY};
    return BehaviorResult.Continue;
  }

  drag(event: MouseEvent): BehaviorResult {
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const subject: GraphEntity | undefined = d3.event.subject;

    const mouseDistanceMoved = Math.sqrt(
      Math.pow(this.dragFrom.x - mouseX, 2) + Math.pow(this.dragFrom.y - mouseY, 2));

    if (mouseDistanceMoved > this.DISTANCE_MOVE_THRESHOLD
      && subject != null
      && subject.type === GraphEntityType.Node
      && !this.graphView.selection.getEntitySet().has(subject.entity)) {
      this.graphView.behaviors.delete(HELPER_BEHAVIOR_KEY);
      this.graphView.behaviors.add(HELPER_BEHAVIOR_KEY,
        new ActiveEdgeCreationHelper(this.graphView, subject.entity as UniversalGraphNode), 10);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
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

  drag(event: MouseEvent): BehaviorResult {
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
    return BehaviorResult.Stop;
  }

  dragEnd(event: MouseEvent): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse(); // TODO: Cache

    if (subject && subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;
      if (node !== this.from) {
        this.graphView.execute(new EdgeCreation('Create connection', {
          from: this.from.hash,
          to: node.hash,
          label: null,
        }, true));
        this.graphView.requestRender();
      }
    }
    return BehaviorResult.RemoveAndStop;
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
