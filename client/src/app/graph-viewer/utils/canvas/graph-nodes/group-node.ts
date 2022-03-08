import 'canvas-plus';

import { TextElement } from '../text-element';
import { Line } from '../lines/lines';
import { BaseRectangleNode, BaseRectangleNodeOptions } from './base-rectangle-node';

export interface GroupNodeOptions extends BaseRectangleNodeOptions {
  textbox: TextElement;
  shapeFillColor?: string;
  stroke?: Line;
  forceHighDetailLevel?: boolean;
}

/**
 * Draws a rectangle node.
 */
export class GroupNode extends BaseRectangleNode {
  readonly resizable = true;
  readonly uniformlyResizable = true;

  readonly textbox: TextElement;
  readonly shapeFillColor: string;
  readonly stroke: Line | undefined;
  readonly forceHighDetailLevel = false;
  readonly LABEL_OFFSET = 20;


  constructor(ctx: CanvasRenderingContext2D, options: GroupNodeOptions) {
    super(ctx, options);
    // TODO: Calculate bbox based on childrens?
    // this.nodeWidth = (this.width != null ? this.width : this.textbox.actualWidth) + this.padding;
    // this.nodeHeight = (this.height != null ? this.height : this.textbox.actualHeight) + this.padding;
  }

  draw(transform: any): void {
    const ctx = this.ctx;
    const zoomResetScale = 1 / transform.scale(1).k;

      // Node shape
    ctx.save();
    (ctx as any).roundedRect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight,
        5,
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
    this.textbox.drawCenteredAt(this.x, this.y + (this.nodeHeight / 2) + this.LABEL_OFFSET +
      this.textbox.actualHeightWithInsets / 2.0 + zoomResetScale * ctx.lineWidth);
  }
}
