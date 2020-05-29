import 'canvas-plus';
import { PlacedNode } from 'app/graph-viewer/styles/styles';
import { TextElement } from './text-element';
import { pointOnRect } from '../geometry';
import { Line } from './lines/lines';

export interface RectangleNodeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  textbox: TextElement;
  shapeFillColor?: string;
  stroke?: Line;
  padding?: number;
  forceHighDetailLevel?: boolean;
}

/**
 * Draws a rectangle node.
 */
export class RectangleNode implements PlacedNode {
  readonly resizable = true;

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly textbox: TextElement;
  readonly shapeFillColor: string;
  readonly stroke: Line | undefined;
  readonly padding: number = 10;
  readonly forceHighDetailLevel = false;

  readonly nodeWidth: number;
  readonly nodeHeight: number;
  readonly nodeX: number;
  readonly nodeY: number;
  readonly nodeX2: number;
  readonly nodeY2: number;

  constructor(private ctx: CanvasRenderingContext2D, options: RectangleNodeOptions) {
    Object.assign(this, options);

    this.nodeWidth = (this.width != null ? this.width : this.textbox.actualWidth) + this.padding;
    this.nodeHeight = (this.height != null ? this.height : this.textbox.actualHeight) + this.padding;
    this.nodeX = this.x - this.nodeWidth / 2;
    this.nodeY = this.y - this.nodeHeight / 2;
    this.nodeX2 = this.nodeX + this.nodeWidth;
    this.nodeY2 = this.nodeY + this.nodeHeight;
  }

  getBoundingBox() {
    return {
      minX: this.nodeX,
      minY: this.nodeY,
      maxX: this.nodeX2,
      maxY: this.nodeY2,
    };
  }

  isPointIntersecting(x: number, y: number): boolean {
    return x >= this.nodeX && x <= this.nodeX2 && y >= this.nodeY && y <= this.nodeY2;
  }

  lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
    const {x, y} = pointOnRect(
      lineOriginX,
      lineOriginY,
      this.nodeX,
      this.nodeY,
      this.nodeX2,
      this.nodeY2,
      true
    );
    return [x, y];
  }

  draw(transform: any): void {
    const ctx = this.ctx;
    const zoomResetScale = 1 / transform.scale(1).k;
    const highDetailLevel = this.forceHighDetailLevel || transform.k >= 0.35;

    if (highDetailLevel) {
      // Node shape
      ctx.save();
      (ctx as any).roundedRect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight,
        5
      );
      if (this.shapeFillColor) {
        ctx.fillStyle = this.shapeFillColor;
        ctx.fill();
      }
      if (this.stroke) {
        this.stroke.setContext(ctx);
        ctx.lineWidth = zoomResetScale * ctx.lineWidth;
        ctx.stroke();
      }
      ctx.restore();

      // Node text
      this.textbox.drawCenteredAt(this.x, this.y);
    } else {
      // Node shape
      ctx.save();
      (ctx as any).roundedRect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight,
        3
      );
      if (this.shapeFillColor) {
        ctx.fillStyle = this.shapeFillColor;
        ctx.fill();
      }
      if (this.stroke) {
        this.stroke.setContext(ctx);
        ctx.lineWidth = zoomResetScale * ctx.lineWidth;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
