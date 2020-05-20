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
        transform: any,
        options: PlacementOptions): PlacedEdge {
    const zoomResetScale = 1 / transform.scale(1).k;
    const highDetailLevel = transform.k >= 0.35 || options.selected || options.highlighted;
    const lineWidth = (options.highlighted ? 1.5 : 1) * zoomResetScale;
    const color = !options.highlighted || options.highlighted ? '#2B7CE9' : '#ACCFFF';
    const endTerminator = new Arrowhead(16, {
      fillStyle: color,
      strokeStyle: null,
      lineWidth,
    });

    return new class implements PlacedEdge {
      isPointIntersecting(x: number, y: number): boolean {
        const x1 = Math.min(from.data.x, to.data.x);
        const x2 = Math.max(from.data.x, to.data.x);
        const y1 = Math.min(from.data.y, to.data.y);
        const y2 = Math.max(from.data.y, to.data.y);
        return getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) <= 2;
      }

      render(): void {
        // Because we draw an arrowhead at the end, we need the line to stop at the
        // shape's edge and not at the node center, so we need to find the intersection between
        // the line and the node box
        const [toX, toY] = placedTo.lineIntersectionPoint(
          from.data.x,
          from.data.y
        );

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

      renderLayer2() {
        if (!d.label) {
          return;
        }

        if (highDetailLevel) {
          const [toX, toY] = placedTo.lineIntersectionPoint(
            from.data.x,
            from.data.y
          );

          const [fromX, fromY] = placedFrom.lineIntersectionPoint(
            to.data.x,
            to.data.y
          );

          ctx.font = (options.highlighted ? 'bold ' : '') + '16px Roboto';
          const textSize = ctx.measureText(d.label);
          const width = textSize.width;
          const height = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
          const x = Math.abs(fromX - toX) / 2 + Math.min(fromX, toX) - width / 2;
          const y = Math.abs(fromY - toY) / 2 + Math.min(fromY, toY) + height / 2;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3 * zoomResetScale;
          ctx.strokeText(d.label, x, y);
          ctx.fillStyle = '#888';
          ctx.fillText(d.label, x, y);
        }
      }
    }();
  }
}


/**
 * Default renderer used for edges.
 */
export const DEFAULT_EDGE_STYLE = new BasicEdgeStyle();
