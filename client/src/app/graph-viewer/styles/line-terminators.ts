/**
 * A renderer for a line end.
 */
export interface LineTerminatorRenderer {
  /**
   * Draws the line end at the provided position.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return coordinates where the line would start/end at
   */
  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): { x: number, y: number };
}

/**
 * Draws an arrowhead.
 */
export class Arrowhead implements LineTerminatorRenderer {
  public length;
  public inset = 0;
  public fillStyle = '#000';
  public strokeStyle = null;
  public lineWidth = 1;

  /**
   * Create a new arrowhead instance.
   */
  constructor(public width: number, options: {
    length?: number;
    inset?: number;
    fillStyle?: string;
    strokeStyle?: string;
    lineWidth?: number;
  } = {}) {
    if (options.length == null) {
      options.length = width * 2;
    }
    Object.assign(this, options);
  }

  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): { x: number, y: number } {
    let returnPoint = null;
    const points = [];
    points.push(0, 0);
    points.push(-1 * this.length, this.width);
    points.push(-1 * (1 - this.inset) * this.length, 0);
    points.push(-1 * this.length, -1 * this.width);
    points.push(0, 0);

    ctx.beginPath();
    ctx.lineWidth = this.lineWidth;
    if (this.fillStyle) {
      ctx.fillStyle = this.fillStyle;
    }
    if (this.strokeStyle) {
      ctx.strokeStyle = this.strokeStyle;
    }

    for (const {x, y, i} of transformControlPoints(startX, startY, endX, endY, points)) {
      if (i === 2) {
        returnPoint = {x, y};
      }
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (this.fillStyle) {
      ctx.fill();
    }
    if (this.strokeStyle) {
      ctx.stroke();
    }
    return returnPoint;
  }
}

/**
 * Draws a circle at the end of the line.
 */
export class CircleTerminator implements LineTerminatorRenderer {
  public spacing = 0;
  public fillStyle = '#000';
  public strokeStyle = null;
  public lineWidth = 1;

  constructor(public radius: number,
              options: {
                spacing?: number
                fillStyle?: string;
                strokeStyle?: string;
                lineWidth?: number;
              } = {}) {
    Object.assign(this, options);
  }

  draw(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) {
    const points = [];
    points.push(-1 * (this.radius + this.spacing), 0);

    ctx.beginPath();
    ctx.lineWidth = this.lineWidth;
    if (this.fillStyle) {
      ctx.fillStyle = this.fillStyle;
    }
    if (this.strokeStyle) {
      ctx.strokeStyle = this.strokeStyle;
    }

    for (const {x, y, i} of transformControlPoints(startX, startY, endX, endY, points)) {
      ctx.arc(x, y, this.radius, 0, 2 * Math.PI);
      if (this.fillStyle) {
        ctx.fill();
      }
      if (this.strokeStyle) {
        ctx.stroke();
      }
    }

    let returnPoint: {x: number, y: number} = null;
    for (const {x, y, i} of transformControlPoints(
      startX, startY, endX, endY, [-1 * (2 * this.radius + this.spacing), 0]
    )) {
      returnPoint = {x, y};
    }
    return returnPoint;
  }
}

/**
 * Transform the provided list of points to be rotated and moved
 * according to the direction of the line segment between
 * [startX, startY] to [endX, endY] and relative to [endX, endY].
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
