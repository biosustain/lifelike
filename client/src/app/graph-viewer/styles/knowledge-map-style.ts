import { UniversalEdgeStyle, UniversalGraphEdge, UniversalGraphNode, UniversalNodeStyle } from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, NodeRenderStyle, PlacedEdge, PlacedNode, PlacementOptions } from 'app/graph-viewer/styles/styles';
import { nullCoalesce } from 'app/graph-viewer/utils/types';
import { RectangleNode } from 'app/graph-viewer/utils/canvas/rectangle-node';
import { CanvasTextbox } from 'app/graph-viewer/utils/canvas/canvas-textbox';
import { FontIconNode } from 'app/graph-viewer/utils/canvas/font-icon-node';
import { AnnotationStyle, annotationTypesMap } from 'app/shared/annotation-styles';
import { Arrowhead, DiamondHead } from 'app/graph-viewer/utils/canvas/line-terminators';
import { StandardEdge } from 'app/graph-viewer/utils/canvas/standard-edge';

export class KnowledgeMapStyle implements NodeRenderStyle, EdgeRenderStyle {
  placeNode(d: UniversalGraphNode, ctx: CanvasRenderingContext2D, placementOptions: PlacementOptions): PlacedNode {
    const styleData: UniversalNodeStyle = nullCoalesce(d.style, {});
    const labelFontSizeScale = nullCoalesce(styleData.fontSizeScale, 1);
    const labelFont = (placementOptions.highlighted || placementOptions.selected ? 'bold ' : '') +
      (16 * labelFontSizeScale) + 'px Roboto';
    const forceHighDetailLevel = placementOptions.selected || placementOptions.highlighted;

    let iconCode = null;
    let color = '#000';

    // Check if there's some annotation styles to apply
    const annotationStyle: AnnotationStyle = annotationTypesMap.get(d.label);
    if (annotationStyle) {
      if (annotationStyle.color) {
        color = annotationStyle.color;
      }
      if (annotationStyle.iconCode) {
        iconCode = annotationStyle.iconCode;
      }
    }

    if (iconCode) {
      const iconLabelColor = nullCoalesce(d.icon ? d.icon.color : null, color);
      const iconSize = nullCoalesce(d.icon ? d.icon.size : null, 50);
      const iconFontFace = nullCoalesce(d.icon ? d.icon.face : null, 'FontAwesome');
      const iconFont = `${iconSize}px ${iconFontFace}`;

      const iconTextbox = new CanvasTextbox(ctx, {
        text: nullCoalesce(iconCode, '?'),
        font: iconFont,
        fillStyle: iconLabelColor,
      });

      const labelTextbox = new CanvasTextbox(ctx, {
        text: d.display_name,
        font: labelFont,
        fillStyle: iconLabelColor,
      });

      return new FontIconNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        iconTextbox,
        labelTextbox,
        forceHighDetailLevel,
      });
    } else {
      const textbox = new CanvasTextbox(ctx, {
        width: d.data.width,
        height: d.data.height,
        text: d.display_name,
        font: labelFont,
        fillStyle: nullCoalesce(styleData.fillColor, color),
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: nullCoalesce(d.data.width, textbox.actualWidth),
        height: nullCoalesce(d.data.height, textbox.actualHeight),
        textbox,
        shapeStrokeColor: nullCoalesce(styleData.strokeColor, '#2B7CE9'),
        shapeFillColor: (placementOptions.highlighted ? '#E4EFFF' : (placementOptions.selected ? '#efefef' : '#fff')),
        lineType: nullCoalesce(styleData.lineType, 'solid'),
        lineWidth: nullCoalesce(styleData.lineWidthScale, 1) *
          (placementOptions.selected || placementOptions.highlighted ? 1.3 : 1),
        forceHighDetailLevel,
      });
    }
  }

  placeEdge(d: UniversalGraphEdge,
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
