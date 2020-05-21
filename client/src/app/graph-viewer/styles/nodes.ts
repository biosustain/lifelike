import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { NodeRenderStyle, PlacedNode, PlacementOptions } from './graph-styles';
import { calculateNodeColor, calculateNodeFont } from './shared';
import { pointOnRect } from '../utils/geometry';
import 'canvas-plus';

/**
 * Renders a node as a rounded rectangle.
 */
export class RoundedRectangleNodeStyle implements NodeRenderStyle {
  place(d: UniversalGraphNode,
        ctx: CanvasRenderingContext2D,
        options: PlacementOptions): PlacedNode {
    ctx.font = calculateNodeFont(d, options.selected, options.highlighted);

    const textSize = ctx.measureText(d.display_name);
    const textWidth = textSize.width;
    const textActualHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
    const padding = 10;
    const nodeWidth = d.data.width != null ? d.data.width : textSize.width + padding;
    const nodeHeight = d.data.height != null ? d.data.height : textActualHeight + padding;
    const nodeX = d.data.x - nodeWidth / 2;
    const nodeY = d.data.y - nodeHeight / 2;
    const nodeX2 = nodeX + nodeWidth;
    const nodeY2 = nodeY + nodeHeight;
    const color = calculateNodeColor(d);

    return new class implements PlacedNode {
      getBoundingBox() {
        return {
          minX: nodeX,
          minY: nodeY,
          maxX: nodeX2,
          maxY: nodeY2,
        };
      }

      isPointIntersecting(x: number, y: number): boolean {
        return x >= nodeX && x <= nodeX2 && y >= nodeY && y <= nodeY2;
      }

      lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
        const {x, y} = pointOnRect(
          lineOriginX,
          lineOriginY,
          nodeX,
          nodeY,
          nodeX2,
          nodeY2,
          true
        );
        return [x, y];
      }

      render(transform: any): void {
        const zoomResetScale = 1 / transform.scale(1).k;
        const highDetailLevel = transform.k >= 0.35 || options.selected || options.highlighted;

        ctx.font = calculateNodeFont(d, options.selected, options.highlighted);

        if (highDetailLevel) {
          // Node box
          ctx.lineWidth = zoomResetScale * (options.highlighted ? 2 : 1.5);
          ctx.fillStyle = (options.highlighted ? '#E4EFFF' : (options.selected ? '#efefef' : '#fff'));
          (ctx as any).roundedRect(
            nodeX,
            nodeY,
            nodeWidth,
            nodeHeight,
            5
          );
          ctx.fill();
          ctx.strokeStyle = '#2B7CE9';
          ctx.stroke();

          // Node text
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = zoomResetScale * 1.5;
          ctx.fillStyle = color;
          ctx.fillText(d.display_name, d.data.x - textWidth / 2, d.data.y + textActualHeight / 2);
        } else {
          // Node box
          ctx.lineWidth = zoomResetScale * (options.highlighted ? 2 : 1.5);
          ctx.fillStyle = (options.highlighted ? '#E4EFFF' : (options.selected ? '#efefef' : '#fff'));
          (ctx as any).roundedRect(
            nodeX,
            nodeY,
            nodeWidth,
            nodeHeight,
            5
          );
          ctx.fill();
          ctx.strokeStyle = '#2B7CE9';
          ctx.stroke();
        }
      }
    }();
  }
}

/**
 * Renders a node as an icon.
 */
export class IconNodeStyle implements NodeRenderStyle {
  constructor(public iconString: string,
              public fontName: string = 'FontAwesome',
              public fontSize: number = 50,
              public color: string = null) {
  }

  place(d: UniversalGraphNode,
        ctx: CanvasRenderingContext2D,
        options: PlacementOptions): PlacedNode {
    const style = this;
    const iconFont = this.fontSize + 'px ' + this.fontName;
    const displayNameFont = calculateNodeFont(d, options.selected, options.highlighted);
    const yShift = 7; // Older renderer was a little off?
    const iconLabelSpacing = 2;
    const color = calculateNodeColor(d);

    ctx.font = iconFont;
    const iconTextSize = ctx.measureText(style.iconString);
    const iconTextWidth = iconTextSize.width;
    const iconTextHeight = iconTextSize.actualBoundingBoxAscent + iconTextSize.actualBoundingBoxDescent;

    ctx.font = displayNameFont;
    const displayNameSize = ctx.measureText(d.display_name);
    const displayNameTextWidth = displayNameSize.width;
    const displayNameTextHeight = displayNameSize.actualBoundingBoxAscent + displayNameSize.actualBoundingBoxDescent;

    const totalHeight = iconTextHeight + displayNameTextHeight + iconLabelSpacing;
    const minY = d.data.y - (totalHeight / 2) + yShift;

    return new class implements PlacedNode {
      getBoundingBox() {
        return {
          minX: d.data.x - Math.max(style.fontSize, displayNameTextWidth) / 2,
          minY,
          maxX: d.data.x + Math.max(style.fontSize, displayNameTextWidth) / 2,
          maxY: minY + totalHeight,
        };
      }

      isPointIntersecting(x: number, y: number): boolean {
        // What if the text doesn't render or it's too small? Then the user
        // can't select this node anymore, which is bad
        const clickableIconTextWidth = Math.max(iconTextWidth, 50);

        return (
          // Check intersection with the icon
          x >= d.data.x - clickableIconTextWidth / 2 &&
          x <= d.data.x + clickableIconTextWidth / 2 &&
          y >= minY &&
          y <= minY + totalHeight
        ) || (
          // Check intersection with the text
          x >= d.data.x - displayNameTextWidth / 2 &&
          x <= d.data.x + displayNameTextWidth / 2 &&
          y >= minY + iconTextHeight + iconLabelSpacing &&
          y <= minY + totalHeight
        );
      }

      lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
        // TODO: Polygonal intersection because we have an icon 'head' and a text 'body'
        return [d.data.x, d.data.y];
      }

      render(transform: any): void {
        const highDetailLevel = transform.k >= 0.35 || options.selected || options.highlighted;
        ctx.beginPath();

        // Draw icon
        ctx.font = iconFont;
        ctx.fillStyle = style.color || color;
        ctx.fillText(
          style.iconString,
          d.data.x - iconTextWidth / 2,
          minY + iconTextSize.actualBoundingBoxAscent
        );

        // Either draw the text or draw a box representing the text
        if (highDetailLevel) {
          ctx.font = displayNameFont;
          ctx.fillText(
            d.display_name,
            d.data.x - displayNameTextWidth / 2,
            minY + iconTextHeight + iconLabelSpacing + displayNameSize.actualBoundingBoxAscent
          );
        } else {
          ctx.fillStyle = '#ccc';
          ctx.fillRect(
            d.data.x - displayNameTextWidth / 2,
            minY + iconTextHeight + iconLabelSpacing,
            displayNameTextWidth,
            displayNameTextHeight
          );
        }
      }
    }();
  }
}

/**
 * Default renderer used for nodes.
 */
export const DEFAULT_NODE_STYLE = new RoundedRectangleNodeStyle();
