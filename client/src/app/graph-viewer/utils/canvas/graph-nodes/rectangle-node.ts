import 'canvas-plus';

import { TextElement } from '../text-element';
import { Line } from '../lines/lines';
import { BaseRectangleNode, BaseRectangleNodeOptions } from './base-rectangle-node';
import { DEFAULT_LABEL_FONT_SIZE, drawStroke, drawStrokeAndFill, VISIBLE_TEXT_THRESHOLD } from '../shared';

export interface RectangleNodeOptions extends BaseRectangleNodeOptions {
  textbox: TextElement;
  shapeFillColor?: string;
  stroke?: Line;
  forceVisibleText?: boolean;
}

/**
 * Draws a rectangle node.
 */
export class RectangleNode extends BaseRectangleNode {
  readonly resizable = true;
  readonly uniformlyResizable = false;

  readonly textbox: TextElement;
  readonly shapeFillColor: string;
  readonly stroke: Line | undefined;
  readonly forceVisibleText = false;

  // This controls how 'rounded' the rect is
  readonly ARC_SIZE = 5;


  constructor(ctx: CanvasRenderingContext2D, options: RectangleNodeOptions) {
    super(ctx, options);
    this.nodeWidth = (this.width ?? this.textbox.actualWidth) + this.padding;
    this.nodeHeight = (this.height ?? this.textbox.actualHeight) + this.padding;
  }

  draw(transform: any): void {
    const ctx = this.ctx;
    const zoomResetScale = 1 / transform.scale(1).k;
    const fontSize = parseFloat(this.textbox.font);
    const visibleText = this.forceVisibleText ||
      transform.k >= VISIBLE_TEXT_THRESHOLD * (DEFAULT_LABEL_FONT_SIZE / fontSize);

    // Node shape
    ctx.save();
    (ctx as any).roundedRect(
      this.bbox.minX,
      this.bbox.minY,
      this.nodeWidth,
      this.nodeHeight,
      this.ARC_SIZE,
    );

    drawStrokeAndFill(ctx, this.shapeFillColor);
    drawStroke(ctx, this.stroke, zoomResetScale);

    ctx.restore();

    // Node text
    if (visibleText) {
      this.textbox.drawCenteredAt(this.x, this.y);
    }
  }
}
