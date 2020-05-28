import { UniversalEdgeStyle, UniversalGraphEdge, UniversalGraphNode, UniversalNodeStyle } from 'app/drawing-tool/services/interfaces';
import { EdgeRenderStyle, NodeRenderStyle, PlacedEdge, PlacedNode, PlacementOptions } from 'app/graph-viewer/styles/styles';
import { nullCoalesce, nullIfEmpty } from 'app/graph-viewer/utils/types';
import { RectangleNode } from 'app/graph-viewer/utils/canvas/rectangle-node';
import { TextAlignment, TextElement } from 'app/graph-viewer/utils/canvas/text-element';
import { FontIconNode } from 'app/graph-viewer/utils/canvas/font-icon-node';
import { AnnotationStyle, annotationTypesMap } from 'app/shared/annotation-styles';
import { StandardEdge } from 'app/graph-viewer/utils/canvas/standard-edge';
import { Arrowhead } from '../utils/canvas/line-heads/arrow';
import { DiamondHead } from '../utils/canvas/line-heads/diamond';
import { LineHeadRenderer } from '../utils/canvas/line-heads/line-heads';
import { CircleHead } from '../utils/canvas/line-heads/circle';
import { CrossAxisLineHead } from '../utils/canvas/line-heads/cross-axis';
import { EmptyLineHead } from '../utils/canvas/line-heads/empty';
import { CompoundLineHead } from '../utils/canvas/line-heads/compound';
import { RectangleHead } from '../utils/canvas/line-heads/rectangle';
import { LINE_HEAD_TYPES, LineHeadType } from '../../drawing-tool/services/line-head-types';

export class KnowledgeMapStyle implements NodeRenderStyle, EdgeRenderStyle {
  private readonly defaultSourceLineEndDescriptor: string = null;
  private readonly defaultTargetLineEndDescriptor = 'arrow';
  private readonly lineEndBaseSize = 16;
  private readonly maxWidthIfUnsized = 400;
  private readonly maxHeightIfUnsized = 400;

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

    if (d.label === 'note' && styleData.showDetail) {
      const textbox = new TextElement(ctx, {
        width: d.data.width,
        height: d.data.height,
        maxWidth: this.maxWidthIfUnsized,
        maxHeight: this.maxHeightIfUnsized,
        text: d.data.detail,
        font: labelFont,
        fillStyle: nullCoalesce(styleData.fillColor, '#999'),
        horizontalAlign: TextAlignment.Start,
        verticalAlign: TextAlignment.Start,
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: nullCoalesce(d.data.width, textbox.actualWidth),
        height: nullCoalesce(d.data.height, textbox.actualHeight),
        textbox,
        shapeStrokeColor: nullCoalesce(styleData.strokeColor, '#999'),
        shapeFillColor: null,
        lineType: nullCoalesce(styleData.lineType, 'dashed'),
        lineWidth: nullCoalesce(styleData.lineWidthScale, 1) *
          (placementOptions.selected || placementOptions.highlighted ? 1.3 : 1),
        forceHighDetailLevel,
      });
    } else if (iconCode) {
      const iconLabelColor = nullCoalesce(d.icon ? d.icon.color : null, color);
      const iconSize = nullCoalesce(d.icon ? d.icon.size : null, 50);
      const iconFontFace = nullCoalesce(d.icon ? d.icon.face : null, 'FontAwesome');
      const iconFont = `${iconSize}px ${iconFontFace}`;

      const iconTextbox = new TextElement(ctx, {
        text: nullCoalesce(iconCode, '?'),
        font: iconFont,
        fillStyle: iconLabelColor,
      });

      const labelTextbox = new TextElement(ctx, {
        maxWidth: this.maxWidthIfUnsized,
        maxLines: 1,
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
      const textbox = new TextElement(ctx, {
        width: d.data.width,
        maxWidth: d.data.width ? null : this.maxWidthIfUnsized,
        height: d.data.height,
        maxHeight: d.data.height ? null : this.maxHeightIfUnsized,
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
    const sourceHeadType = styleData.sourceHeadType;
    const targetHeadType = styleData.targetHeadType;

    const sourceLineEnd = this.createHead(
      nullIfEmpty(sourceHeadType),
      lineWidth,
      strokeColor,
      this.defaultSourceLineEndDescriptor
    );

    const targetLineEnd = this.createHead(
      nullIfEmpty(targetHeadType),
      lineWidth,
      strokeColor,
      this.defaultTargetLineEndDescriptor
    );

    const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
    const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);

    const textbox = d.label ? new TextElement(ctx, {
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
      sourceLineEnd,
      targetLineEnd,
      strokeColor,
      lineType,
      lineWidth,
      forceHighDetailLevel: placementOptions.selected || placementOptions.highlighted,
    });
  }

  createHead(type: string | undefined,
             lineWidth: number,
             strokeColor: string,
             defaultType: string | undefined = null): LineHeadRenderer | undefined {
    const effectiveType = nullCoalesce(nullIfEmpty(type), nullIfEmpty(defaultType));

    if (effectiveType == null) {
      return null;
    }

    let descriptor;
    const lineHeadType: LineHeadType = LINE_HEAD_TYPES.get(effectiveType);
    if (lineHeadType) {
      descriptor = lineHeadType.descriptor;
    } else {
      return null;
    }

    return new CompoundLineHead(
      descriptor.split(',').map(token => {
        switch (token) {
          case 'spacer':
            return [
              new EmptyLineHead(this.lineEndBaseSize * 0.3),
            ];
          case 'cross-axis':
            return [
              new EmptyLineHead(this.lineEndBaseSize * 0.3),
              new CrossAxisLineHead(this.lineEndBaseSize, {
                fillStyle: strokeColor,
                strokeStyle: strokeColor,
              }),
            ];
          case 'circle':
            return [
              new CircleHead(
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                })
            ];
          case 'diamond':
            return [
              new DiamondHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                })
            ];
          case 'square':
            return [
              new RectangleHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                })
            ];
          default:
            return [new Arrowhead(
              this.lineEndBaseSize + lineWidth, {
                fillStyle: strokeColor,
                strokeStyle: null,
                length: this.lineEndBaseSize,
                lineWidth,
              })];
        }
      }).reduce((compound, lineEnds) => {
        for (const lineEnd of lineEnds) {
          compound.push(lineEnd);
        }
        return compound;
      }, [])
    );
  }
}
