/**
 * Contains metrics of the drawn terminator.
 */
export interface DrawnLineHead {
  /**
   * The start X position of the terminator. If the terminator is the
   * arrowhead, this would be the back of the arrow. The start position
   * should be touching the shape and not simply be the position on the
   * bounding box.
   */
  startX: number;
  /**
   * The start Y position of the terminator. If the terminator is the
   * arrowhead, this would be the back of the arrow. The start position
   * should be touching the shape and not simply be the position on the
   * bounding box.
   */
  startY: number;
}

/**
 * A renderer for a line end.
 */
export interface LineHeadRenderer {
  /**
   * Draws the line end at the provided position.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return metrics about the drawn terminator
   */
  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead;
}

interface ShapeTerminatorOptions {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
}

/**
 * Abstract class for a terminator handles the fill and stroke properties.
 */
export abstract class AbstractShapeHead implements LineHeadRenderer {
  public fillStyle = '#000';
  public strokeStyle = null;
  public lineWidth = 1;

  /**
   * Create a new instance.
   * @param options additional options
   */
  constructor(options: ShapeTerminatorOptions = {}) {
    Object.assign(this, options);
  }

  /**
   * Get the line width considering whether stroke is even enabled.
   */
  get effectiveLineWidth(): number {
    return this.strokeStyle ? this.lineWidth : 0;
  }

  /**
   * Get the start control point of the terminator as x, y coordinates in a flat array.
   */
  abstract getStartControlPoint(): [number, number];

  /**
   * Draw the path.
   */
  abstract createPath(ctx: CanvasRenderingContext2D,
                      startX: number,
                      startY: number,
                      endX: number,
                      endY: number): void;

  /**
   * Get the start point.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return metrics about the drawn terminator
   */
  getStartPoint(ctx: CanvasRenderingContext2D,
                startX: number,
                startY: number,
                endX: number,
                endY: number): [number, number] {
    return transformControlPoint(startX, startY, endX, endY, ...this.getStartControlPoint());
  }

  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead {
    // Create path
    this.createPath(ctx, startX, startY, endX, endY);

    // Properties
    ctx.lineWidth = this.lineWidth;
    if (this.fillStyle) {
      ctx.fillStyle = this.fillStyle;
    }
    if (this.strokeStyle) {
      ctx.strokeStyle = this.strokeStyle;
    }

    // Fill the shape
    if (this.fillStyle) {
      ctx.fill();
    }

    // Stroke the shape
    if (this.strokeStyle) {
      ctx.stroke();
    }

    // Get the returned metrics
    const [terminatorStartX, terminatorStartY] = this.getStartPoint(ctx, startX, startY, endX, endY);
    return {
      startX: terminatorStartX,
      startY: terminatorStartY,
    };
  }
}

/**
 * Abstract class for a terminator that is based on a drawn shape. Handles
 * fill style, stroke style, and line width properties calls stroke()
 * and fill() as necessary.
 */
export abstract class AbstractPathHead extends AbstractShapeHead {
  lineJoin: CanvasLineJoin = 'round';
  lineCap: CanvasLineCap = 'round';

  /**
   * Get the control points of the shape as a list of x, y coordinates in a flat array.
   */
  abstract getControlPoints(): number[];

  createPath(ctx: CanvasRenderingContext2D,
             startX: number,
             startY: number,
             endX: number,
             endY: number) {
    // Create path
    ctx.beginPath();
    ctx.lineJoin = this.lineJoin;
    ctx.lineCap = this.lineCap;
    for (const {x, y, i} of transformControlPoints(startX, startY, endX, endY, this.getControlPoints())) {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
}

/**
 * Custom terminator using provided control points.
 */
export class CustomHead extends AbstractPathHead {
  private readonly controlPoints: number[];
  private readonly startControlPoint: [number, number];

  /**
   * Create a new instance.
   * @param controlPoints the control points of the shape
   * @param startControlPoint the start control point
   * @param options additional options
   */
  constructor(controlPoints: number[],
              startControlPoint: [number, number],
              options: ShapeTerminatorOptions = {}) {
    super(options);
    this.controlPoints = controlPoints;
    this.startControlPoint = startControlPoint;
  }

  getControlPoints(): number[] {
    return this.controlPoints;
  }

  getStartControlPoint(): [number, number] {
    return this.startControlPoint;
  }
}

/**
 * Draws an arrowhead.
 */
export class Arrowhead extends CustomHead {
  constructor(width: number, options: {
    length?: number;
    inset?: number;
  } & ShapeTerminatorOptions = {}) {
    super([
      0, 0,
      -1 * (options.length || width), width / 2,
      -1 * (1 - (options.inset || 0)) * (options.length || width), 0,
      -1 * (options.length || width), -1 * width / 2,
      0, 0,
    ], [
      -1 * (1 - (options.inset || 0)) * (options.length || width), 0
    ], options);
  }
}

/**
 * Draws a diamond head.
 */
export class DiamondHead extends CustomHead {
  constructor(width: number,
              length: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super([
      0, 0,
      -length / 2, -width / 2,
      -length, 0,
      -length / 2, width / 2,
      0, 0,
    ], [
      -length, 0
    ], options);
  }
}

/**
 * Draws a circle at the end of the line.
 */
export class CircleHead extends AbstractShapeHead {
  private readonly radius;
  private readonly centerControlPoint: [number, number];
  private readonly startControlPoint: [number, number];

  constructor(diameter: number,
              options: ShapeTerminatorOptions = {}) {
    super(options);
    this.radius = diameter / 2;
    this.centerControlPoint = [-1 * diameter / 2, 0];
    this.startControlPoint = [-1 * (2 * diameter / 2), 0];
  }

  createPath(ctx: CanvasRenderingContext2D,
             startX: number,
             startY: number,
             endX: number,
             endY: number): void {
    const [x, y] = transformControlPoint(startX, startY, endX, endY, ...this.centerControlPoint);
    ctx.arc(x, y, this.radius, 0, 2 * Math.PI);
  }

  getStartControlPoint(): [number, number] {
    return this.startControlPoint;
  }
}

/**
 * Draws a rectangle at the end of the line.
 */
export class RectangleHead extends CustomHead {
  lineCap: CanvasLineCap = 'butt';

  constructor(width: number,
              height: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super([
      0, -height / 2,
      -width, -height / 2,
      -width, height / 2,
      0, height / 2,
      0, -height / 2,
    ], [
      -width, 0
    ], options);
  }
}

/**
 * Draws a cross-axis line at the end of the line.
 */
export class CrossAxisLineHead extends RectangleHead {
  constructor(height: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super(height * 0.25, height, options);
  }
}

/**
 * A terminator that just takes up space.
 */
export class EmptyTerminator implements LineHeadRenderer {
  /**
   * Create an instance.
   * @param spacing the amount of dead weight to take up
   */
  constructor(public spacing: number) {
  }

  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead {
    const startPoint = transformControlPoint(
      startX, startY, endX, endY, -1 * this.spacing, 0
    );
    return {
      startX: startPoint[0],
      startY: startPoint[1],
    };
  }
}

/**
 * A terminator that combines other terminators end-to-end.
 */
export class CompoundTerminator implements LineHeadRenderer {
  /**
   * Create a new instance.
   * @param children list of terminators, whether the first one is at the end
   */
  constructor(public children: LineHeadRenderer[]) {
  }

  draw(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) {
    let lastEnd: DrawnLineHead = {startX: endX, startY: endY};
    for (const child of this.children) {
      lastEnd = child.draw(ctx, startX, startY, lastEnd.startX, lastEnd.startY);
    }
    return lastEnd;
  }
}

/**
 * Use the given line segment from [startX, startY] to [endX, endY] to
 * calculate the revolution that must be applied to the point [x, y] if
 * revolved around [endX, endY].
 * @param startX the start X
 * @param startY the start Y
 * @param endX the end X
 * @param endY the end Y
 * @param x the X to transform
 * @param y the Y to transform
 */
function transformControlPoint(startX: number,
                               startY: number,
                               endX: number,
                               endY: number,
                               x: number,
                               y: number): [number, number] {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sin = dy / len;
  const cos = dx / len;

  return [
    x * cos - y * sin + endX,
    x * sin + y * cos + endY
  ];
}

/**
 * Use the given line segment from [startX, startY] to [endX, endY] to
 * calculate the revolution that must be applied to the provided points if
 * revolved around [endX, endY].
 * @param startX the start X
 * @param startY the start Y
 * @param endX the end X
 * @param endY the end Y
 * @param points a list of points
 */
function* transformControlPoints(startX: number,
                                 startY: number,
                                 endX: number,
                                 endY: number,
                                 points: number[]) {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sin = dy / len;
  const cos = dx / len;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] * cos - points[i + 1] * sin + endX;
    const y = points[i] * sin + points[i + 1] * cos + endY;
    yield {
      x, y, i: i / 2
    };
  }
}
