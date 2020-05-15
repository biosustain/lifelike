import { UniversalGraphEdge, UniversalGraphNode } from './interfaces';
import { annotationTypesMap } from '../../shared/annotation-styles';

// ========================================
// Interfaces
// ========================================

// Styles
// ---------------------------------

/**
 * A style of node rendering, used to render different shapes of nodes.
 */
export interface NodeRenderStyle {
  /**
   * Place the node on the provided canvas context and return an object
   * that provides metrics and can render the object.
   * @param d the node
   * @param ctx the context
   * @param transform the zoom and pan transform
   * @param options extra options for placement
   */
  place(d: UniversalGraphNode,
        ctx: CanvasRenderingContext2D,
        transform: any,
        options: PlacementOptions): PlacedNode;
}

/**
 * A style of edge rendering, used to render different edge styles.
 */
export interface EdgeRenderStyle {
  /**
   * Place the edge on the provided canvas context and return an object
   * that provides metrics and can render the object.
   * @param d the edge
   * @param from the start node
   * @param to the end node
   * @param placedFrom the placed object the edge will start from
   * @param placedTo the placed object the edge will end at
   * @param ctx the context
   * @param transform the zoom and pan transform
   * @param options extra options for placement
   */
  place(d: UniversalGraphEdge,
        from: UniversalGraphNode,
        to: UniversalGraphNode,
        placedFrom: PlacedNode,
        placedTo: PlacedNode,
        ctx: CanvasRenderingContext2D,
        transform: any,
        options: PlacementOptions): PlacedEdge;
}

/**
 * Extra options for placement.
 */
export interface PlacementOptions {
  selected;
  highlighted;
}

// Placed objects (instantiated by styles)
// ---------------------------------

/**
 * An object that has been placed on a canvas that can be rendered.
 *
 * See {@link PlacedNode} and {@link PlacedEdge}.
 */
export interface PlacedObject {
  /**
   * Check to see if the given coordinates intersects with the object.
   * @param x the X coordinate to check
   * @param y the Y coordinate to check
   */
  isPointIntersecting(x: number, y: number): boolean;

  /**
   * Render the object on the canvas.
   */
  render(): void;
}

/**
 * A placed node.
 */
export interface PlacedNode extends PlacedObject {
  /**
   * Get the first intersection point of a line coming from outside this object
   * to the center of the object. This method is vital to figuring out if an
   * object has been clicked by the mouse.
   * @param lineOriginX the line's origin X
   * @param lineOriginY the line's origin Y
   * @return [x, y]
   */
  lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[];
}

/**
 * A placed edge.
 */
export interface PlacedEdge extends PlacedObject {
  /**
   * Render additional things that need to be placed on a layer above render();
   */
  renderLayer2(): void;
}

// ========================================
// Node styles
// ========================================

/**
 * Renders a node as a rounded rectangle.
 */
export class RoundedRectangleNodeStyle implements NodeRenderStyle {
  place(d: UniversalGraphNode,
        ctx: CanvasRenderingContext2D,
        transform: any,
        options: PlacementOptions): PlacedNode {
    ctx.font = calculateNodeFont(d, transform, options.selected, options.highlighted);

    const textSize = ctx.measureText(d.display_name);
    const textWidth = textSize.width;
    const textActualHeight = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
    const nodeWidth = textSize.width + 10;
    const nodeHeight = textActualHeight + 10;
    const nodeX = d.data.x - nodeWidth / 2;
    const nodeY = d.data.y - nodeHeight / 2;
    const nodeX2 = nodeX + nodeWidth;
    const nodeY2 = nodeY + nodeHeight;
    const noZoomScale = 1 / transform.scale(1).k;

    return new class implements PlacedNode {
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

      render(): void {
        ctx.font = calculateNodeFont(d, transform, options.selected, options.highlighted);

        // Node box
        (ctx as any).roundedRect(
          nodeX,
          nodeY,
          nodeWidth,
          nodeHeight,
          5 * noZoomScale
        );
        ctx.strokeStyle = '#2B7CE9';
        ctx.lineWidth = noZoomScale * (options.highlighted ? 2 : 1.5);
        ctx.fillStyle = (options.highlighted ? '#E4EFFF' : (options.selected ? '#efefef' : '#fff'));
        ctx.fill();
        ctx.stroke();

        // Node outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = noZoomScale * 1.5;

        // Node text
        ctx.fillStyle = calculateNodeColor(d);
        ctx.fillText(d.display_name, d.data.x - textWidth / 2, d.data.y + textActualHeight / 2);
      }
    }();
  }
}

// ========================================
// Edge styles
// ========================================

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
    const noZoomScale = 1 / transform.scale(1).k;

    return new class implements PlacedEdge {
      isPointIntersecting(x: number, y: number): boolean {
        return false;
      }

      render(): void {
        // Because we draw an arrowhead at the end, we need the line to stop at the
        // shape's edge and not at the node center, so we need to find the intersection between
        // the line and the node box
        const [toX, toY] = placedTo.lineIntersectionPoint(
          from.data.x,
          from.data.y
        );

        // Draw line
        const lineWidth = (options.highlighted ? 1 : 0.5) * noZoomScale;
        ctx.fillStyle = !options.highlighted || options.highlighted ? '#2B7CE9' : '#ACCFFF';

        // TODO: This ugly -- don't add methods to window objects
        (ctx as any).arrow(
          from.data.x,
          from.data.y,
          toX,
          toY,
          [0, lineWidth, -10 * noZoomScale, lineWidth, -10 * noZoomScale, 5 * noZoomScale]);
        ctx.fill();
      }

      renderLayer2() {
        const [toX, toY] = placedTo.lineIntersectionPoint(
          from.data.x,
          from.data.y
        );

        const [fromX, fromY] = placedFrom.lineIntersectionPoint(
          to.data.x,
          to.data.y
        );

        ctx.font = (options.highlighted ? 'bold ' : '') + (noZoomScale * 14) + 'px Roboto';
        const textSize = ctx.measureText(d.label);
        const width = textSize.width;
        const height = textSize.actualBoundingBoxAscent + textSize.actualBoundingBoxDescent;
        const x = Math.abs(fromX - toX) / 2 + Math.min(fromX, toX) - width / 2;
        const y = Math.abs(fromY - toY) / 2 + Math.min(fromY, toY) + height / 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * noZoomScale;
        ctx.strokeText(d.label, x, y);
        ctx.fillStyle = '#888';
        ctx.fillText(d.label, x, y);
      }
    }();
  }
}

// ========================================
// Shared routines
// ========================================

/**
 * Calculate the primary color for the given node.
 * @param d the node in question
 */
function calculateNodeColor(d: UniversalGraphNode): string {
  // TODO: Refactor into reusable class
  return annotationTypesMap.get(d.label).color;
}

/**
 * Calculate the font string for a graph node.
 * @param d the node to calculate for
 * @param transform the zoom and pan transform
 * @param selected whether the node is selected
 * @param highlighted whether the node is highlighted
 */
function calculateNodeFont(d: UniversalGraphNode, transform: any, selected: boolean, highlighted: boolean): string {
  // TODO: Refactor into reusable class
  const scaleFactor = 1 / transform.scale(1).k;
  return (highlighted || selected ? 'bold ' : '') + (scaleFactor * 15) + 'px Roboto';
}

// TODO: Clean up / find an alternative
function pointOnRect(x, y, minX, minY, maxX, maxY, validate) {
  if (validate && (minX < x && x < maxX) && (minY < y && y < maxY)) {
    return {x, y};
  }
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  // if (midX - x == 0) -> m == ±Inf -> minYx/maxYx == x (because value / ±Inf = ±0)
  const m = (midY - y) / (midX - x);

  if (x <= midX) { // check "left" side
    const minXy = m * (minX - x) + y;
    if (minY <= minXy && minXy <= maxY) {
      return {x: minX, y: minXy};
    }
  }

  if (x >= midX) { // check "right" side
    const maxXy = m * (maxX - x) + y;
    if (minY <= maxXy && maxXy <= maxY) {
      return {x: maxX, y: maxXy};
    }
  }

  if (y <= midY) { // check "top" side
    const minYx = (minY - y) / m + x;
    if (minX <= minYx && minYx <= maxX) {
      return {x: minYx, y: minY};
    }
  }

  if (y >= midY) { // check "bottom" side
    const maxYx = (maxY - y) / m + x;
    if (minX <= maxYx && maxYx <= maxX) {
      return {x: maxYx, y: maxY};
    }
  }

  // edge case when finding midpoint intersection: m = 0/0 = NaN
  if (x === midX && y === midY) {
    return {x, y};
  }

  // Should never happen :) If it does, please tell me!
  return {x, y};
}

// ========================================
// Declarations
// ========================================

/**
 * Default renderer used for nodes.
 */
export const DEFAULT_NODE_STYLE = new RoundedRectangleNodeStyle();
/**
 * Default renderer used for edges.
 */
export const DEFAULT_EDGE_STYLE = new BasicEdgeStyle();
