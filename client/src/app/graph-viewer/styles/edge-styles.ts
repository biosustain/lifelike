import { UniversalEdgeStyle, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, PlacedEdge, PlacedNode, PlacementOptions } from './graph-styles';
import { Arrowhead, DiamondHead } from './line-terminators';
import { nullCoalesce } from '../utils/types';
import { StandardEdge } from '../utils/canvas/standard-edge';
import { CanvasTextbox } from '../utils/canvas/canvas-textbox';

/**
 * Renders a basic edge.
 */
export class KnowledgeGraphEdgeStyle implements EdgeRenderStyle {
  place(d: UniversalGraphEdge,
        from: UniversalGraphNode,
        to: UniversalGraphNode,
        placedFrom: PlacedNode,
        placedTo: PlacedNode,
        ctx: CanvasRenderingContext2D,
        placementOptions: PlacementOptions): PlacedEdge {
    const styleData: UniversalEdgeStyle = nullCoalesce(d.style, {});
    const fontSizeScale = nullCoalesce(styleData.fontSizeScale, 1);
    const strokeColor = nullCoalesce(styleData.strokeColor, '#2B7CE9');
    const lineType = nullCoalesce(styleData.lineType, 'solid');
    const lineWidthScale = nullCoalesce(styleData.lineWidthScale, 1);
    const lineWidth = lineWidthScale * (placementOptions.highlighted ? 1.5 : 1);
    const sourceEndType = styleData.sourceEndType;
    const targetEndType = styleData.targetEndType;

    const targetTerminator = targetEndType === 'diamond'
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

    const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
    const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);

    const textbox = d.label ? new CanvasTextbox(ctx, {
      text: d.label,
      font: (placementOptions.highlighted ? 'bold ' : '') + (16 * fontSizeScale) + 'px Roboto',
      fillStyle: '#888',
      strokeStyle: '#fff',
      strokeWidth: 3,
    }) : null;

    return new StandardEdge(ctx, {
      source: {
        x: fromX,
        y: fromY,
      },
      target: {
        x: toX,
        y: toY,
      },
      textbox,
      targetTerminator,
      strokeColor,
      lineType,
      lineWidth,
      forceHighDetailLevel: placementOptions.selected || placementOptions.highlighted,
    });
  }
}
