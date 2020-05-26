import * as d3 from 'd3';

import { GraphEntityType, UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { Arrowhead } from '../styles/line-terminators';
import { GraphCanvasView } from '../graph-canvas-view';
import { AbstractCanvasBehavior, BehaviorResult } from './behaviors';

export class InteractiveEdgeCreation extends AbstractCanvasBehavior {
  constructor(private readonly graphView: GraphCanvasView) {
    super();
  }

  doubleClick(): BehaviorResult {
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

  click(): BehaviorResult {
    const subject = this.graphView.getEntityAtMouse(); // TODO: Cache

    if (subject && subject.type === GraphEntityType.Node) {
      const node = subject.entity as UniversalGraphNode;
      if (node !== this.from) {
        const label = prompt('Label please', '') || ''; // Doesn't work for 0
        // TODO: handle invalidation and history
        this.graphView.edges.push({
          from: this.from.hash,
          to: node.hash,
          label,
        });
        this.graphView.requestRender(); // TODO: Don't call unless needed
        return BehaviorResult.RemoveAndContinue;
      }
    } else {
      return BehaviorResult.RemoveAndContinue;
    }
  }

  doubleClick(): BehaviorResult {
    return BehaviorResult.Stop;
  }

  mouseMove(): BehaviorResult {
    // TODO: Cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = this.graphView.transform.invertX(mouseX);
    const graphY = this.graphView.transform.invertY(mouseY);
    const entityAtMouse = this.graphView.getEntityAtMouse();

    this.to = {
      data: {
        x: graphX,
        y: graphY,
      },
    };

    this.graphView.requestRender();
    return BehaviorResult.Continue;
  }

  drag(): BehaviorResult {
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
