import { UniversalGraphNode, UniversalNodeStyle } from 'app/drawing-tool/services/interfaces';
import { NodeRenderStyle, PlacedNode, PlacementOptions } from './graph-styles';
import { nullCoalesce } from '../utils/types';
import { RectangleNode } from '../utils/canvas/rectangle-node';
import { CanvasTextbox } from '../utils/canvas/canvas-textbox';
import { FontIconNode } from '../utils/canvas/font-icon-node';
import { AnnotationStyle, annotationTypesMap } from '../../shared/annotation-styles';

export class KnowledgeGraphNodeStyle implements NodeRenderStyle {
  place(d: UniversalGraphNode, ctx: CanvasRenderingContext2D, placementOptions: PlacementOptions): PlacedNode {
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
}
