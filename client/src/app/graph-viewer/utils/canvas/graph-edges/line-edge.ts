import { PlacedEdge } from 'app/graph-viewer/styles/styles';
import { getLinePointIntersectionDistance } from '../../geometry';
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

  constructor(private ctx: CanvasRenderingContext2D, options: StandardEdgeOptions) {
    Object.assign(this, options);
    if (this.textbox) {
      this.labelX = Math.abs(this.source.x - this.target.x) / 2 +
        Math.min(this.source.x, this.target.x);
      this.labelY = Math.abs(this.source.y - this.target.y) / 2 +
        Math.min(this.source.y, this.target.y);
    }
  }

  isPointIntersecting(x: number, y: number): boolean {
    const x1 = Math.min(this.source.x, this.target.x);
    const x2 = Math.max(this.source.x, this.target.x);
    const y1 = Math.min(this.source.y, this.target.y);
    const y2 = Math.max(this.source.y, this.target.y);
    return getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) <= 2;
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
