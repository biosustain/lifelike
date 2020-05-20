import { UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, PlacedEdge, PlacedNode, PlacementOptions } from './graph-styles';
import { getLinePointIntersectionDistance } from '../utils/geometry';
import { Arrowhead } from './line-terminators';

/**
 * Renders a basic edge.
 */
export class BasicEdgeStyle implements EdgeRenderStyle {
  place(d: UniversalGraphEdge,
        from: UniversalGraphNode,
        to: UniversalGraphNode,
        placedFrom: PlacedNode,
        placedTo: PlacedNode,
        ctx: CanvasRenderingContext2D,
        options: PlacementOptions): PlacedEdge {
    const lineWidth = (options.highlighted ? 1.5 : 1);
    const color = !options.highlighted || options.highlighted ? '#2B7CE9' : '#ACCFFF';
    const endTerminator = new Arrowhead(16, {
      fillStyle: color,
      strokeStyle: null,
      lineWidth,
    });

    const font = (options.highlighted ? 'bold ' : '') + '16px Roboto';
    const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
    const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);
    ctx.font = font;
    const textSize = ctx.measureText(d.label);
    const labelTextWidth = textSize.width;
    const labelTextHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
    const labelX = Math.abs(fromX - toX) / 2 + Math.min(fromX, toX) - labelTextWidth / 2;
    const labelY = Math.abs(fromY - toY) / 2 + Math.min(fromY, toY) + labelTextHeight / 2;

    return new class implements PlacedEdge {
      isPointIntersecting(x: number, y: number): boolean {
        const x1 = Math.min(from.data.x, to.data.x);
        const x2 = Math.max(from.data.x, to.data.x);
        const y1 = Math.min(from.data.y, to.data.y);
        const y2 = Math.max(from.data.y, to.data.y);
        return getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) <= 2;
      }

      render(transform: any): void {
        const drawnTerminator = endTerminator.draw(ctx, from.data.x, from.data.y, toX, toY);

        // Draw line
        ctx.beginPath();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.moveTo(from.data.x, from.data.y);
        ctx.lineTo(drawnTerminator.startX, drawnTerminator.startY);
        ctx.stroke();

        ctx.setLineDash([]);
      }

      renderLayer2(transform: any) {
        if (!d.label) {
          return;
        }

        const highDetailLevel = transform.k >= 0.35 || options.selected || options.highlighted;

        if (highDetailLevel) {
          ctx.beginPath();
          ctx.font = font;
          // Draw text border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeText(d.label, labelX, labelY);
          // Draw text fill
          ctx.fillStyle = '#888';
          ctx.fillText(d.label, labelX, labelY);
        }
      }
    }();
  }
}


/**
 * Default renderer used for edges.
 */
export const DEFAULT_EDGE_STYLE = new BasicEdgeStyle();
