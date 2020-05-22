import { UniversalEdgeStyle, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, PlacedEdge, PlacedNode, PlacementOptions } from './graph-styles';
import { getLinePointIntersectionDistance } from '../utils/geometry';
import { Arrowhead, DiamondHead } from './line-terminators';
import { nullCoalesce } from '../utils/types';

/**
 * Renders a basic edge.
 */
export class BasicEdgeStyle implements EdgeRenderStyle {
  fontSizeScale = 1;
  strokeColor?: string;
  lineType = 'solid';
  lineWidth = 1.5;
  lineWidthScale = 1;
  sourceEndType = 'arrow';
  targetEndType = 'arrow';

  place(d: UniversalGraphEdge,
        from: UniversalGraphNode,
        to: UniversalGraphNode,
        placedFrom: PlacedNode,
        placedTo: PlacedNode,
        ctx: CanvasRenderingContext2D,
        options: PlacementOptions): PlacedEdge {
    const styleData: UniversalEdgeStyle = nullCoalesce(d.style, {});
    const fontSizeScale = nullCoalesce(styleData.fontSizeScale, this.fontSizeScale);
    const strokeColor = nullCoalesce(styleData.strokeColor, this.strokeColor, '#2B7CE9');
    const lineType = nullCoalesce(styleData.lineType, this.lineType);
    const lineWidthScale = nullCoalesce(styleData.lineWidthScale, this.lineWidthScale);
    const lineWidth = this.lineWidth * lineWidthScale * (options.highlighted ? 1.5 : 1);
    const sourceEndType = nullCoalesce(styleData.sourceEndType, this.sourceEndType);
    const targetEndType = nullCoalesce(styleData.targetEndType, this.targetEndType);

    const endTerminator = targetEndType === 'diamond'
      ? new DiamondHead(16 + lineWidth, 16 + lineWidth, {
        fillStyle: strokeColor,
        strokeStyle: null,
      })
      : new Arrowhead(16 + lineWidth, {
        fillStyle: strokeColor,
        strokeStyle: null,
        length: 16,
        lineWidth,
      });

    const font = (options.highlighted ? 'bold ' : '') + (16 * fontSizeScale) + 'px Roboto';
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
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'butt';
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = strokeColor;
        ctx.moveTo(from.data.x, from.data.y);
        ctx.lineTo(drawnTerminator.startX, drawnTerminator.startY);
        ctx.setLineDash(lineType === 'dashed' ? [15, 5] : []);
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
