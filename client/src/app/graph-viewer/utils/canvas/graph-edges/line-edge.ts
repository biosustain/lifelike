import { PlacedEdge } from 'app/graph-viewer/styles/styles';
import { distanceUnsq, getLinePointIntersectionDistance } from '../../geometry';
import { TextElement } from '../text-element';
import { LineHead } from '../line-heads/line-heads';
import { Line } from '../lines/lines';

export interface StandardEdgeOptions {
  source: { x: number, y: number };
  target: { x: number, y: number };
  textbox?: TextElement;
  sourceLineEnd?: LineHead;
  targetLineEnd?: LineHead;
  stroke?: Line;
  forceHighDetailLevel?: boolean;
}

/**
 * Draws an edge using a {@link Line}.
 */
export class LineEdge implements PlacedEdge {
  readonly source: { x: number, y: number };
  readonly target: { x: number, y: number };
  readonly textbox: TextElement | undefined;
  readonly sourceLineEnd: LineHead | undefined;
  readonly targetLineEnd: LineHead | undefined;
  readonly stroke: Line | undefined;
  readonly forceHighDetailLevel = false;

  readonly labelX: number;
  readonly labelY: number;
  readonly labelMinX: number;
  readonly labelMaxX: number;
  readonly labelMinY: number;
  readonly labelMaxY: number;

  constructor(private ctx: CanvasRenderingContext2D, options: StandardEdgeOptions) {
    Object.assign(this, options);
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
    }
  }

  isPointIntersecting(x: number, y: number): boolean {
    if (this.isPointIntersectingTextbox(x, y)) {
      return true;
    }

    const x1 = Math.min(this.source.x, this.target.x);
    const x2 = Math.max(this.source.x, this.target.x);
    const y1 = Math.min(this.source.y, this.target.y);
    const y2 = Math.max(this.source.y, this.target.y);
    return getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) <= 2;
  }

  private isPointIntersectingTextbox(x: number, y: number): boolean {
    if (!this.textbox) {
      return false;
    }

    return x >= this.labelMinX && x <= this.labelMaxX && y >= this.labelMinY && y <= this.labelMaxY;
  }

  getPointDistanceUnsq(x: number, y: number): number {
    if (this.isPointIntersectingTextbox(x, y)) {
      return 0;
    }

    const dx = this.target.x - this.source.x;
    const dy = this.target.y - this.source.y;
    const l2 = dx * dx + dy * dy;

    if (l2 === 0) {
      return distanceUnsq(x, y, this.source.x, this.source.y);
    }

    let t = ((x - this.source.x) * dx + (y - this.source.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));

    return distanceUnsq(x, y, this.source.x + t * dx, this.source.y + t * dy);
  }

  draw(transform: any): void {
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
      this.stroke.setContext(ctx);
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.stroke();
      ctx.restore();
    }
  }

  drawLayer2(transform: any) {
    if (this.textbox) {
      const highDetailLevel = this.forceHighDetailLevel || transform.k >= 0.35;

      if (highDetailLevel) {
        this.textbox.drawCenteredAt(this.labelX, this.labelY);
      }
    }

  }
}
