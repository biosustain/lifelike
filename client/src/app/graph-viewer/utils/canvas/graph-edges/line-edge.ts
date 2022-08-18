import { ZoomTransform } from 'd3-zoom';

import { PlacedEdge } from 'app/graph-viewer/styles/styles';

import { distanceUnsq, getLinePointIntersectionDistance, pointOnRect } from '../../geometry';
import { TextElement } from '../text-element';
import { LineHead } from '../line-heads/line-heads';
import { Line } from '../lines/lines';
import {
  BoundingBox,
  drawTextNotSmallerThanMin,
  EDGE_SELECTION_WIDTH,
  isBBoxEnclosing,
  NO_TEXT_THRESHOLD,
  Point,
  SELECTION_SHADOW_COLOR
} from '../shared';
import { SolidLine } from '../lines/solid';

export interface StandardEdgeOptions {
  source: Point;
  target: Point;
  textbox?: TextElement;
  sourceLineEnd?: LineHead;
  targetLineEnd?: LineHead;
  lineWidth?: number;
  stroke?: Line;
  forceVisibleText?: boolean;
}

/**
 * Draws an edge using a {@link Line}.
 */
export class LineEdge extends PlacedEdge {
  readonly source: Point;
  readonly target: Point;
  readonly textbox: TextElement | undefined;
  readonly sourceLineEnd: LineHead | undefined;
  readonly targetLineEnd: LineHead | undefined;
  readonly lineWidth: number | undefined;
  readonly stroke: Line | undefined;
  // TODO: Do we want this? It seems like a generally useless idea
  readonly forceVisibleText = false;

  readonly labelX: number;
  readonly labelY: number;
  readonly labelMinX: number;
  readonly labelMaxX: number;
  readonly labelMinY: number;
  readonly labelMaxY: number;
  readonly boundingBox: BoundingBox;


  constructor(private ctx: CanvasRenderingContext2D, options: StandardEdgeOptions) {
    super();
    Object.assign(this, options);

    const xBounds = [
      this.source.x,
      this.target.x,
    ];
    const yBounds = [
      this.source.y,
      this.target.y,
    ];

    if (this.textbox) {
      this.labelX = Math.abs(this.source.x - this.target.x) / 2 +
        Math.min(this.source.x, this.target.x);
      this.labelY = Math.abs(this.source.y - this.target.y) / 2 +
        Math.min(this.source.y, this.target.y);

      // Store these values for faster isPointIntersectingTextbox()
      this.labelMinX = this.labelX - this.textbox.actualWidth / 2;
      this.labelMaxX = this.labelX + this.textbox.actualWidth / 2;
      this.labelMinY = this.labelY - this.textbox.actualHeight / 2;
      this.labelMaxY = this.labelY + this.textbox.actualHeight / 2;

      xBounds.push(this.labelMinX, this.labelMaxX);
      yBounds.push(this.labelMinY, this.labelMaxY);
    }

    this.boundingBox = {
      minX: Math.min(...xBounds),
      maxX: Math.max(...xBounds),
      minY: Math.min(...yBounds),
      maxY: Math.max(...yBounds),
    };
  }

  getBoundingBox(): BoundingBox {
    return this.boundingBox;
  }

  isPointIntersecting({x, y}: Point): boolean {
    if (this.isPointIntersectingTextbox({x, y})) {
      return true;
    }

    const x1 = Math.min(this.source.x, this.target.x);
    const x2 = Math.max(this.source.x, this.target.x);
    const y1 = Math.min(this.source.y, this.target.y);
    const y2 = Math.max(this.source.y, this.target.y);
    return getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) <= 2;
  }

  private isPointIntersectingTextbox({x, y}: Point): boolean {
    if (!this.textbox) {
      return false;
    }

    return x >= this.labelMinX && x <= this.labelMaxX && y >= this.labelMinY && y <= this.labelMaxY;
  }

  getPointDistanceUnsq(point: Point): number {
    if (this.isPointIntersectingTextbox(point)) {
      return 0;
    }


    // TODO: WHAT
    const dx = this.target.x - this.source.x;
    const dy = this.target.y - this.source.y;
    const l2 = dx * dx + dy * dy;

    if (l2 === 0) {
      return distanceUnsq(point, {x: this.source.x, y: this.source.y});
    }

    let t = ((point.x - this.source.x) * dx + (point.y - this.source.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));

    return distanceUnsq(point, {x: this.source.x + t * dx, y: this.source.y + t * dy});
  }

  isBBoxEnclosing(bbox: BoundingBox): boolean {
    return isBBoxEnclosing(bbox, this.getBoundingBox());
  }

  draw(transform: ZoomTransform, selected: boolean = false): void {
    if (selected) {
      this.drawSelection();
    }
    const ctx = this.ctx;

    if (this.sourceLineEnd) {
      this.sourceLineEnd.draw(
        ctx,
        this.target.x, this.target.y,
        this.source.x, this.source.y,
      );
    }

    if (this.targetLineEnd) {
      this.targetLineEnd.draw(
        ctx,
        this.source.x, this.source.y,
        this.target.x, this.target.y,
      );
    }

    // Draw line
    if (this.stroke) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.source.x, this.source.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      this.stroke.setContext(ctx);
      ctx.stroke();
      ctx.restore();
    }
  }


  drawSelection() {
    const ctx = this.ctx;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.source.x, this.source.y);
    ctx.lineTo(this.target.x, this.target.y);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    const stroke = new SolidLine((this.lineWidth ?? 1) + EDGE_SELECTION_WIDTH, SELECTION_SHADOW_COLOR, {
          lineCap: 'square',
        });
    stroke.setContext(ctx);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws textbox over the edge. As the edge labels were "getting too small too fast" (see LL-4172)
   * We scale their size (by temporal increase of the font size), draw them, and restore the font.
   * This ensures, that the label edge would be always at least as big, as it would be when
   * visibleTextThreshold zoom-out level is reached.
   * NOTE: This works, since we are not using line breaks in edge label (which as width based).
   * @param transform current graph transform
   */
  drawLayer2(transform: ZoomTransform) {
    if (this.textbox && transform.k > NO_TEXT_THRESHOLD) {
      drawTextNotSmallerThanMin(this.textbox, transform.k, this.labelX, this.labelY);
    }
  }

  lineIntersectionPoint(lineOrigin: Point): Point {
    return pointOnRect(
      lineOrigin,
      this.boundingBox,
      true,
    );
  }

}
