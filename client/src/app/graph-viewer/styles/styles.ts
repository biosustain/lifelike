import { UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

/**
 * A style of node rendering, used to render different shapes of nodes.
 */
export interface NodeRenderStyle {
  /**
   * Place the node on the provided canvas context and return an object
   * that provides metrics and can render the object.
   * @param d the node
   * @param ctx the context
   * @param options extra options for placement
   */
  placeNode(d: UniversalGraphNode,
            ctx: CanvasRenderingContext2D,
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
   * @param options extra options for placement
   */
  placeEdge(d: UniversalGraphEdge,
            from: UniversalGraphNode,
            to: UniversalGraphNode,
            placedFrom: PlacedNode,
            placedTo: PlacedNode,
            ctx: CanvasRenderingContext2D,
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
   * @param transform the zoom and pan transform
   */
  draw(transform: any): void;
}

/**
 * A placed node.
 */
export interface PlacedNode extends PlacedObject {
  /**
   * Get the bounding box of the node.
   */
  getBoundingBox(): {
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  };

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
   * @param transform the zoom and pan transform
   */
  drawLayer2(transform: any): void;
}
