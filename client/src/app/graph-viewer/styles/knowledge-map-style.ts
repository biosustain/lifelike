import {
  DETAIL_NODE_LABELS,
  Hyperlink,
  UniversalGraphGroup,
  Source,
  UniversalEdgeStyle,
  UniversalGraphEdge,
  UniversalGraphNode,
  UniversalNodeStyle,
} from 'app/drawing-tool/services/interfaces';
import {
  EdgeRenderStyle,
  GroupRenderStyle,
  NodeRenderStyle,
  PlacedEdge,
  PlacedGroup,
  PlacedNode,
  PlacementOptions,
} from 'app/graph-viewer/styles/styles';
import { nullCoalesce, nullIfEmpty } from 'app/shared/utils/types';
import { RectangleNode } from 'app/graph-viewer/utils/canvas/graph-nodes/rectangle-node';
import { TextAlignment, TextElement } from 'app/graph-viewer/utils/canvas/text-element';
import { FontIconNode } from 'app/graph-viewer/utils/canvas/graph-nodes/font-icon-node';
import { AnnotationStyle, annotationTypesMap } from 'app/shared/annotation-styles';
import { LineEdge } from 'app/graph-viewer/utils/canvas/graph-edges/line-edge';
import { LINE_HEAD_TYPES, LineHeadType } from 'app/drawing-tool/services/line-head-types';
import { BLACK_COLOR, FA_CUSTOM_ICONS, Unicodes, WHITE_COLOR } from 'app/shared/constants';
import { getSupportedFileCodes } from 'app/shared/utils';

import { Arrowhead } from '../utils/canvas/line-heads/arrow';
import { DiamondHead } from '../utils/canvas/line-heads/diamond';
import { LineHead } from '../utils/canvas/line-heads/line-heads';
import { CircleHead } from '../utils/canvas/line-heads/circle';
import { CrossAxisLineHead } from '../utils/canvas/line-heads/cross-axis';
import { EmptyLineHead } from '../utils/canvas/line-heads/empty';
import { CompoundLineHead } from '../utils/canvas/line-heads/compound';
import { RectangleHead } from '../utils/canvas/line-heads/rectangle';
import { Line } from '../utils/canvas/lines/lines';
import { SolidLine } from '../utils/canvas/lines/solid';
import { DashedLine } from '../utils/canvas/lines/dashed';
import { ResourceManager } from '../utils/resource/resource-manager';
import { ImageNode } from '../utils/canvas/graph-nodes/image-node';
import { GroupNode } from '../utils/canvas/graph-groups/group-node';
import { BORDER_BLUE_COLOR, DEFAULT_LABEL_FONT_SIZE, LineTypes } from '../utils/canvas/shared';


/**
 * Implements the style used on the Knowledge Graph.
 */
export class KnowledgeMapStyle implements NodeRenderStyle, EdgeRenderStyle, GroupRenderStyle {
  private readonly STANDARD_BORDER = LineTypes.Solid;
  private readonly NO_BORDER = LineTypes.Blank;
  private readonly FONT = 'Roboto, "Helvetica Neue", sans-serif';
  private readonly defaultSourceLineEndDescriptor: string = null;
  private readonly defaultTargetLineEndDescriptor = 'arrow';
  private readonly lineEndBaseSize = 16;
  private readonly maxWidthIfUnsized = 400;
  private readonly maxIconNodeWidthIfUnsized = 200;
  private readonly maxHeightIfUnsized = 400;
  private readonly detailTypeBackgrounds = new Map([
    ['note', '#FFF6D5'],
    ['link', '#DCF1F1'],
  ]);

  constructor(protected readonly imageManager: ResourceManager<string, CanvasImageSource>) {
  }

  placeNode(d: UniversalGraphNode, ctx: CanvasRenderingContext2D, placementOptions: PlacementOptions): PlacedNode {
    const styleData: UniversalNodeStyle = d.style || {};
    const labelFontSizeScale = styleData.fontSizeScale ?? 1;
    const labelFont = (DEFAULT_LABEL_FONT_SIZE * labelFontSizeScale) + 'px ' + this.FONT;
    const forceVisibleText = placementOptions.selected || placementOptions.highlighted;

    // Pull style from the annotation types map
    const annotationStyle: AnnotationStyle = annotationTypesMap.get(d.label);


    let iconCode: any = annotationStyle?.iconCode;

    // First, check user inputs. Second, check for default settings for this entity type. Lastly, use default values.
    // Relation nodes have their font color stored elsewhere, so we need to check that first
    const textColor = styleData.fillColor ?? (annotationStyle?.style?.color || (annotationStyle?.color || BLACK_COLOR));
    const bgColor = styleData.bgColor ?? (annotationStyle?.style?.background || WHITE_COLOR);
    const strokeColor = styleData.strokeColor ?? (annotationStyle?.style?.border || BORDER_BLUE_COLOR);

    if (DETAIL_NODE_LABELS.has(d.label) && styleData.showDetail) {
      // ---------------------------------
      // Note WITH detail
      // ---------------------------------

      const textbox = new TextElement(ctx, {
        width: d.data.width,
        height: d.data.height,
        maxWidth: !d.data.width ? this.maxWidthIfUnsized : null,
        maxHeight: !d.data.height ? this.maxHeightIfUnsized : null,
        text: d.data.detail != null ? d.data.detail : '',
        font: labelFont,
        fillStyle: styleData.fillColor ?? BLACK_COLOR,
        horizontalAlign: TextAlignment.Start,
        verticalAlign: TextAlignment.Start,
        topInset: 5,
        leftInset: 5,
        bottomInset: 5,
        rightInset: 5,
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: d.data.width || textbox.actualWidthWithInsets,
        height: d.data.height || textbox.actualHeightWithInsets,
        textbox,
        stroke: this.createLine(
          styleData.lineType ?? this.STANDARD_BORDER,
          styleData.lineWidthScale ?? 1 *
          (placementOptions.selected || placementOptions.highlighted ? 1.3 : 1),
          styleData.strokeColor ?? this.detailTypeBackgrounds.get(d.label),
        ),
        shapeFillColor: styleData.bgColor ?? this.detailTypeBackgrounds.get(d.label),
        forceVisibleText,
      });

    } else if (iconCode) {
      // ---------------------------------
      // Generic icon node + Note
      // ---------------------------------
      let specialIconColor;

      // Override icon for link types
      if (d.label === 'link') {
        const links: (Source | Hyperlink)[] = [
          ...(d.data && d.data.sources ? d.data.sources : []),
          ...(d.data && d.data.hyperlinks ? d.data.hyperlinks : []),
        ];
        const iconCodes = this.getIconCode(iconCode, links);
        iconCode = iconCodes.iconCode;
        specialIconColor = iconCodes.specialIconColor;
      }

      let iconTextColor = d.icon?.color ?? textColor;
      if (specialIconColor && !styleData.fillColor) {
        iconTextColor = specialIconColor;
      }
      const iconLabelColor = specialIconColor ?? iconTextColor;
      const iconSize = d.icon?.size || 50;
      // Change font family to custom kit if icon is customly added
      const fontAwesomeFont = FA_CUSTOM_ICONS.includes(iconCode) ? '"Font Awesome Kit"' : '"Font Awesome 5 Pro';
      const iconFontFace = d.icon?.face ?? fontAwesomeFont;
      const iconFont = `${iconSize}px ${iconFontFace}`;

      // Textbox to draw the icon
      const iconTextbox = new TextElement(ctx, {
        text: iconCode ?? '?',
        font: iconFont,
        fillStyle: iconLabelColor,
      });

      // Textbox for the label below the icon
      const labelTextbox = new TextElement(ctx, {
        maxWidth: this.maxIconNodeWidthIfUnsized,
        text: d.display_name,
        font: labelFont,
        fillStyle: iconTextColor,
        horizontalAlign: TextAlignment.Center,
      });

      return new FontIconNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        iconTextbox,
        labelTextbox,
        forceVisibleText,
      });

    } else if (d.image_id) {
      // ---------------------------------
      // Image nodes
      // ---------------------------------
        const labelTextbox = new TextElement(ctx, {
        // Max width of label is equal to the width of the image
        maxWidth: d.data.width,
        text: d.display_name,
        font: labelFont,
        fillStyle: d.style?.fillColor ?? textColor,
        horizontalAlign: TextAlignment.Center,
        });

        return new ImageNode(ctx, {
          x: d.data.x,
          y: d.data.y,
          width: d.data.width,
          height: d.data.height ,
          imageManager: this.imageManager,
          imageId: d.image_id,
          stroke: this.createLine(
            styleData.lineType ?? this.NO_BORDER,
            styleData.lineWidthScale ?? 1,
            styleData.strokeColor ?? WHITE_COLOR,
          ),
          textbox: labelTextbox
        });

    } else {
      // ---------------------------------
      // All other nodes
      // ---------------------------------

      // The text content of the node
      const textbox = new TextElement(ctx, {
        width: d.data.width,
        maxWidth: d.data.width ? null : this.maxWidthIfUnsized,
        height: d.data.height,
        maxHeight: d.data.height ? null : this.maxHeightIfUnsized,
        text: d.display_name,
        font: labelFont,
        fillStyle: textColor,
      });

      return new RectangleNode(ctx, {
        x: d.data.x,
        y: d.data.y,
        width: nullCoalesce(d.data.width, textbox.actualWidth),
        height: nullCoalesce(d.data.height, textbox.actualHeight),
        textbox,
        stroke: this.createLine(
          styleData.lineType ?? this.STANDARD_BORDER,
          styleData.lineWidthScale ?? 1,
          strokeColor,
        ),
        shapeFillColor: bgColor,
        forceVisibleText,
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
    const connectedToNotes = DETAIL_NODE_LABELS.has(from.label) || DETAIL_NODE_LABELS.has(to.label);
    const styleData: UniversalEdgeStyle = d.style || {};
    const fontSizeScale = styleData.fontSizeScale ?? 1;
    const strokeColor = styleData.strokeColor ?? BORDER_BLUE_COLOR;
    const lineType = styleData.lineType ?? connectedToNotes ? LineTypes.Dashed : this.STANDARD_BORDER;
    const lineWidth = styleData.lineWidthScale ?? 1;
    const sourceHeadType = styleData.sourceHeadType;
    const targetHeadType = styleData.targetHeadType;

    // Find where the line intersects with the source and target nodes
    // TODO: Consider using the 'closest point to bbox' instead of intersection point
    const target = placedTo.lineIntersectionPoint({x: from.data.x, y: from.data.y});
    const source = placedFrom.lineIntersectionPoint({x: to.data.x, y: to.data.y});

    // Arrow/whatever at the beginning of the line
    const sourceLineEnd = this.createHead(
      nullIfEmpty(sourceHeadType),
      lineWidth,
      strokeColor,
      this.defaultSourceLineEndDescriptor,
    );

    // Arrow/whatever at the end of the line
    const targetLineEnd = this.createHead(
      nullIfEmpty(targetHeadType),
      lineWidth,
      strokeColor,
      connectedToNotes ? null : this.defaultTargetLineEndDescriptor,
    );

    // Label textbox, if any
    const textbox = d.label ? new TextElement(ctx, {
      text: d.label,
      font: (placementOptions.highlighted ? 'bold ' : '') + (DEFAULT_LABEL_FONT_SIZE * fontSizeScale) + 'px ' + this.FONT,
      fillStyle: '#444',
      strokeStyle: WHITE_COLOR,
      strokeWidth: 3,
    }) : null;

    return new LineEdge(ctx, {
      source,
      target,
      textbox,
      sourceLineEnd,
      targetLineEnd,
      stroke: this.createLine(
        lineType,
        lineWidth,
        strokeColor,
      ),
      forceVisibleText: placementOptions.selected || placementOptions.highlighted,
    });
  }

  placeGroup(d: UniversalGraphGroup,
             ctx: CanvasRenderingContext2D,
             options: PlacementOptions): PlacedGroup {


    const styleData: UniversalNodeStyle = d.style || {};
    const labelFontSizeScale = styleData.fontSizeScale ?? 1;
    const labelFont = (DEFAULT_LABEL_FONT_SIZE * labelFontSizeScale) + 'px ' + this.FONT;

    const labelTextbox = new TextElement(ctx, {
      text: d.display_name,
      font: labelFont,
      fillStyle: d.style?.fillColor ?? BLACK_COLOR,
      horizontalAlign: TextAlignment.Center,
    });

    return new GroupNode(ctx, {
      x: d.data.x,
      y: d.data.y,
      width: d.data.width,
      height: d.data.height,
      stroke: this.createLine(
        styleData.lineType ?? this.NO_BORDER,
        styleData.lineWidthScale ?? 0,
        nullCoalesce(styleData.strokeColor, WHITE_COLOR),
      ),
      textbox: labelTextbox,
      // TODO: This might get change, maybe some default background for groups?
      shapeFillColor: styleData.bgColor ?? WHITE_COLOR,
    });
  }

  // TODO: Refactor linetypes/heads from hardcoded strings into enums
  /**
   * Generate a line object (if any) based on the parameters.
   * @param type the type of line
   * @param width the width of the line
   * @param style the color style
   */
  private createLine(type: string | undefined,
                     width: number,
                     style: string): Line | undefined {
    if (type == null) {
      return null;
    }

    if (type === LineTypes.Blank) {
      return null;
    } else if (type === LineTypes.Dashed) {
      return new DashedLine(width, style, [10, 10]);
    } else if (type === LineTypes.LongDashed) {
      return new DashedLine(width, style, [25, 10]);
    } else if (type === LineTypes.Dotted) {
      return new DashedLine(width, style, [1, 2]);
    } else if (type === LineTypes.TwoDash) {
      return new DashedLine(width, style, [4, 8, 20, 8]);
    } else {
      return new SolidLine(width, style);
    }
  }

  /**
   * Generate a line head object (if any) based on the parameters.
   * @param type the type of head
   * @param lineWidth the width of the line
   * @param strokeColor the stroke color
   * @param defaultType the default fallback type
   */
  private createHead(type: string | undefined,
                     lineWidth: number,
                     strokeColor: string,
                     defaultType: string | undefined = null): LineHead | undefined {
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

    if (descriptor === LineTypes.Blank) {
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
                }),
            ];
          case 'diamond':
            return [
              new DiamondHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                }),
            ];
          case 'square':
            return [
              new RectangleHead(
                this.lineEndBaseSize + lineWidth,
                this.lineEndBaseSize + lineWidth, {
                  fillStyle: strokeColor,
                  strokeStyle: null,
                }),
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
      }, []),
    );
  }

  private getIconCode(iconCode: string, links): {iconCode: string, specialIconColor: string } {
    let specialIconColor;
    for (const link of links) {
      try {
        const url = new URL(link.url, window.location.href);
        if (url.pathname.match(/^\/projects\/([^\/]+)\/bioc\//)) {
          iconCode = Unicodes.BioC;
          break;
        } else if (url.pathname.match(/^\/projects\/([^\/]+)\/enrichment-table\//)) {
          iconCode = Unicodes.EnrichmentTable;
          break;
        } else if (url.pathname.match(/^\/projects\/([^\/]+)\/maps\//)) {
          iconCode = Unicodes.Map;
          break;
        } else if (
          url.pathname.match(/^\/projects\/([^\/]+)\/sankey\//) ||
          url.pathname.match(/^\/projects\/([^\/]+)\/sankey-many-to-many\//)
        ) {
          iconCode = Unicodes.Graph;
        } else if (url.pathname.match(/^\/projects\/([^\/]+)\/files\//)) {
          iconCode = Unicodes.Pdf;
          break;
        } else if (url.pathname.match(/^\/projects\/([^\/]+)\/?$/)) {
          iconCode = Unicodes.Project;
          break;
        } else if (url.protocol.match(/^mailto:$/i)) {
          iconCode = Unicodes.Mail;
          break;
        } else if (url.pathname.match(/^\/files\//)) {
          const domain = link.domain.trim();
          const matchedIcon = getSupportedFileCodes(domain);
          if (matchedIcon !== undefined) {
            iconCode = matchedIcon.unicode;
            specialIconColor = matchedIcon.color;
          }
        }
      } catch (e) {
        return {iconCode, specialIconColor};
      }
    }
    return {iconCode, specialIconColor};
  }

}
