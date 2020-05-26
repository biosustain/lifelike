import { PlacedEdge } from 'app/graph-viewer/styles/styles';
import { getLinePointIntersectionDistance } from '../geometry';
import { TextElement } from './text-element';
import { LineHeadRenderer } from './line-heads/line-heads';

export interface StandardEdgeOptions {
  source: { x: number, y: number };
  target: { x: number, y: number };
  textbox?: TextElement;
  sourceTerminator?: LineHeadRenderer;
  targetTerminator?: LineHeadRenderer;
  strokeColor?: string;
  lineType?: string;
  lineWidth?: number;
  forceHighDetailLevel?: boolean;
}

export class StandardEdge implements PlacedEdge {
  readonly source: { x: number, y: number };
  readonly target: { x: number, y: number };
  readonly textbox: TextElement | undefined;
  readonly sourceTerminator: LineHeadRenderer | undefined;
  readonly targetTerminator: LineHeadRenderer | undefined;
  readonly strokeColor: string;
  readonly lineType: string = 'solid';
  readonly lineWidth: number = 1;
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

    if (this.sourceTerminator) {
      this.sourceTerminator.draw(
        ctx,
        this.target.x, this.target.y,
        this.source.x, this.source.y,
      );
    }

    if (this.targetTerminator) {
      this.targetTerminator.draw(
        ctx,
        this.source.x, this.source.y,
        this.target.x, this.target.y,
      );
    }

    // Draw line
    ctx.save();
    ctx.beginPath();
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.strokeColor;
    ctx.fillStyle = this.strokeColor;
    ctx.moveTo(this.source.x, this.source.y);
    ctx.lineTo(this.target.x, this.target.y);
    ctx.setLineDash(this.lineType === 'dashed' ? [15, 5] : []);
    ctx.stroke();
    ctx.restore();
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
