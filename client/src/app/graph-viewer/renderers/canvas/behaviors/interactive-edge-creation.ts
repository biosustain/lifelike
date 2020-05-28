import * as d3 from 'd3';

import { GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GraphCanvasView } from '../graph-canvas-view';
import { AbstractCanvasBehavior, BehaviorResult } from '../../behaviors';
import { Arrowhead } from '../../../utils/canvas/line-heads/arrow';
import { EdgeCreation } from '../../../actions/edges';
import { isCtrlOrMetaPressed } from '../../../../shared/utils';

export class InteractiveEdgeCreation extends AbstractCanvasBehavior {
  constructor(private readonly graphView: GraphCanvasView) {
    super();
  }

  doubleClick(event: MouseEvent): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse();
    if (subject && subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;
      this.graphView.behaviors.add('interactive-edge', new ActiveEdgeCreation(this.graphView, node), 10);
    }
    return BehaviorResult.Continue;
  }
}

class ActiveEdgeCreation extends AbstractCanvasBehavior {
  private to: {
    data: {
      x, y
    }
  } = null;

  constructor(private readonly graphView: GraphCanvasView,
              private readonly from: UniversalGraphNode) {
    super();
  }

  keyDown(event: KeyboardEvent): BehaviorResult {
    // We can't let someone press delete right now
    return BehaviorResult.Stop;
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
