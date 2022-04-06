import { NodeGroup, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { BoundingBox, Point } from '../utils/behaviors/abstract-node-handle-behavior';

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

export interface GroupRenderStyle {
  /**
   * Place the group within the provided context and return an object
   * that provides metrics and can render the object.
   * @param d the edge
   * @param ctx the context
   * @param options extra options for placement
   */
  placeGroup(d: NodeGroup,
             ctx: CanvasRenderingContext2D,
             options: PlacementOptions): PlacedGroup;
}

/**
 * Extra options for placement.
 */
export interface PlacementOptions {
  selected;
  highlighted;
}

export interface PlacedObjectRenderer {
  enqueueRender(object: PlacedObject);
}

// Placed objects (instantiated by styles)
// ---------------------------------

/**
 * An object that has been placed on a canvas that can be rendered.
 *
 * See {@link PlacedNode} and {@link PlacedEdge}.
 */
export abstract class PlacedObject {
  private placedObjectRenderer: PlacedObjectRenderer;
  protected children: PlacedObject[] = [];

  resizable = false;
  uniformlyResizable = false;

  /**
   * Binds an object to a context.
   * @param renderer the renderer
   */
  bind(renderer: PlacedObjectRenderer) {
    this.placedObjectRenderer = renderer;
    for (const child of this.children) {
      child.bind(renderer);
    }
  }

  /**
   * Get the bounding box.
   */
  abstract getBoundingBox(): BoundingBox;

  /**
   * Check to see if the given coordinates intersects with the object.
   * @param x the X coordinate to check
   * @param y the Y coordinate to check
   */
  abstract isPointIntersecting({x, y}: Point): boolean;

  /**
   * Check to see if the given bbox encloses the object.
   * @param bbox bounding box to check
   */
  abstract isBBoxEnclosing(bbox: BoundingBox): boolean;

  /**
   * Render the object on the canvas.
   * @param transform the zoom and pan transform
   */
  abstract draw(transform: any): void;

  /**
   * Called after the object has been bound to a renderer.
   */
  objectDidBind(): void {
  }

  /**
   * Called before the object is unbound.
   */
  objectWillUnbind(): void {
  }

  /**
   * Called to see if the object should be re-rendered.
   */
  shouldObjectRender(): boolean {
    for (const child of this.children) {
      if (child.shouldObjectRender()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Force this object to be re-rendered at some point.
   */
  forceRender(): void {
    if (this.placedObjectRenderer) {
      this.placedObjectRenderer.enqueueRender(this);
    } else {
      throw new Error('this placed object is not bound yet');
    }
  }
}

// ---------------------------------
// Placed Entities
// ---------------------------------
// Placed Entities are map objects that are translated into class responsible for
// drawing them based on selected properties. They are stored in RenderTree and need
// to be recalculated on every change in the corresponding map entity

/**
 * A placed node.
 */
export abstract class PlacedNode extends PlacedObject {
  // Those are responsible for controlling whether a node has particular set of handles
  // drawn upon selection
  resizable: boolean;
  uniformlyResizable: boolean;

  /**
   * Get the first intersection point of a line coming from outside this object
   * to the center of the object. This method is vital to figuring out if an
   * object has been clicked by the mouse.
   * @param lineOriginX the line's origin X
   * @param lineOriginY the line's origin Y
   * @return [x, y]
   */
  abstract lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[];
}

/**
 * A placed edge.
 */
export abstract class PlacedEdge extends PlacedObject {
  /**
   * Get the shortest distance (unsquared) between the given point and this object.
   * @param x the X coordinate to check
   * @param y the Y coordinate to check
   */
  abstract getPointDistanceUnsq(x: number, y: number): number;

  /**
   * Render additional things that need to be placed on a layer above render();
   * @param transform the zoom and pan transform
   */
  abstract drawLayer2(transform: any): void;
}

/**
 * Placed group.
 */
export abstract class PlacedGroup extends PlacedObject {

}
