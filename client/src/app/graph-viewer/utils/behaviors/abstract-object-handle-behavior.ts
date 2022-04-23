import * as d3 from 'd3'; // TODO: Maybe limit that import

import { GraphEntity, GraphEntityType, GraphGroup, GraphNode, } from 'app/drawing-tool/services/interfaces';
import { nullCoalesce } from 'app/shared/utils/types';

import { AbstractCanvasBehavior, BehaviorResult, DragBehaviorEvent, } from '../../renderers/behaviors';
import { PlacedObject } from '../../styles/styles';
import { CanvasGraphView } from '../../renderers/canvas/canvas-graph-view';

export abstract class AbstractObjectHandleBehavior<T extends Handle> extends AbstractCanvasBehavior {
  protected handle: T | undefined;

  protected constructor(protected readonly graphView: CanvasGraphView,
                        protected readonly target: GraphNode | GraphGroup) {
    super();
  }

  dragStart(event: DragBehaviorEvent): BehaviorResult {
    const transform = this.graphView.transform;
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = transform.invertX(mouseX);
    const graphY = transform.invertY(mouseY);
    const subject = event.entity;

    const point: Point = {x: graphX, y: graphY};

    if (subject?.type === GraphEntityType.Node) {
      this.handle = this.getHandleIntersected(this.graphView.placeNode(subject.entity as GraphNode), point);
      if (this.handle != null) {
        this.activeDragStart(event.event, point, subject);
      }
    } else if (subject?.type === GraphEntityType.Group) {
      this.handle = this.getHandleIntersected(this.graphView.placeGroup(subject.entity as GraphGroup), point);
      if (this.handle != null) {
        this.activeDragStart(event.event, point, subject);
      }
    }

    return BehaviorResult.Continue;
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    if (this.handle) {
      const transform = this.graphView.transform;
      const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
      this.activeDrag(event.event, {x: transform.invertX(mouseX), y: transform.invertY(mouseY)});
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    this.drag(event);
    this.handle = null;
    this.activeDragEnd(event.event);
    return BehaviorResult.Continue;
  }

  getCurrentNodeSize(): { width: number, height: number } {
    return this.getNodeSize(this.target);
  }

  protected getNodeSize(node: GraphNode): { width: number, height: number } {
    let width = node.data.width;
    let height = node.data.height;

    if (width == null || height == null) {
      const bbox = this.graphView.placeNode(node).getBoundingBox();

      if (width == null) {
        width = bbox.maxX - bbox.minX + 1;
      }
      if (height == null) {
        height = bbox.maxY - bbox.minY + 1;
      }
    }

    return {width, height};
  }

  isPointIntersectingNode(placedObject: PlacedObject, {x, y}: Point): boolean {
    return this.getHandleIntersected(placedObject, {x, y}) ? true : undefined;
  }

  getHandleIntersected(placedObject: PlacedObject, {x, y}: Point): T | undefined {
    for (const handle of this.getHandleBoundingBoxes(placedObject)) {
      if (x >= handle.minX && x <= handle.maxX && y >= handle.minY && y <= handle.maxY) {
        return handle;
      }
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
    const placedNode = this.graphView.placeNode(this.target);

    for (const handle of Object.values(this.getHandleBoundingBoxes(placedNode))) {
      this.drawHandle(ctx, transform, handle);
    }
  }

  drawHandle(ctx: CanvasRenderingContext2D, transform: any, {minX, minY, maxX, maxY, displayColor}: T) {
    ctx.beginPath();
    ctx.lineWidth = 1 / transform.scale(1).k;
    if (document.activeElement === this.graphView.canvas) {
      ctx.fillStyle = nullCoalesce(displayColor, '#000');
      ctx.strokeStyle = '#fff';
    } else {
      ctx.fillStyle = '#CCC';
      ctx.strokeStyle = '#999';
    }
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.stroke();

  }

  abstract getHandleBoundingBoxes(placedObject: PlacedObject): T[];

  protected activeDragStart(event: MouseEvent, graphPosition: Point, subject: GraphEntity | undefined) {
  }

  protected activeDrag(event: MouseEvent, graphPosition: Point) {
  }

  protected activeDragEnd(event: MouseEvent) {
  }
}

// TODO: Refactor into using BBox interface?
export interface Handle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  displayColor?: string;
}

// TODO: Move! And correct imports
export interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Check if one (child) bbox is cointained in full by the other (parent) bbox.
 * @param parent - possibly larger Bounding Box to contain child
 * @param child - possible smaller Bounding Box to be contained within parent
 * PS Feel free to change the naming, I am not sure about it, just did not want to do bbox1 and bbox2
 */
export function isBBoxEnclosing(parent: BoundingBox, child: BoundingBox): boolean {
  return child.minX >= parent.minX
      && child.minY >= parent.minY
      && child.maxX <= parent.maxX
      && child.maxY <= parent.maxY;
}

export function isPointIntersecting(bbox: BoundingBox, {x, y}: Point): boolean {
  return (bbox.minX <= x && bbox.maxX >= x && bbox.minY <= y && bbox.maxY >= y);
}
