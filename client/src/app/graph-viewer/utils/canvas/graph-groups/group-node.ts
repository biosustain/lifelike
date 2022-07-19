import 'canvas-plus';

import { TextElement } from '../text-element';
import { Line } from '../lines/lines';
import { BaseRectangleNodeOptions } from '../graph-nodes/base-rectangle-node';
import { PlacedGroup } from '../../../styles/styles';
import { BoundingBox, drawStroke, drawStrokeAndFill, getRectWithMargin, isBBoxEnclosing, Point } from '../shared';

export interface GroupNodeOptions extends BaseRectangleNodeOptions {
  textbox: TextElement;
  shapeFillColor?: string;
  stroke?: Line;
  forceHighDetailLevel?: boolean;
}

/**
 * Draws a rectangle node.
 */
export class GroupNode extends PlacedGroup {
  readonly textbox: TextElement;
  readonly shapeFillColor: string;
  readonly stroke: Line | undefined;
  readonly forceHighDetailLevel = false;
  readonly LABEL_OFFSET = 20;

  readonly width: number;
  readonly height: number;

  readonly x: number;
  readonly y: number;

  readonly boundingBox: BoundingBox;

  constructor(private readonly ctx: CanvasRenderingContext2D, options: GroupNodeOptions) {
    super();
    Object.assign(this, options);

    const minX = this.x - this.width / 2;
    const minY = this.y - this.height / 2;
    this.boundingBox = {
      minX,
      minY,
      maxX: minX + this.width,
      maxY: minY + this.height
    };
  }

  draw(transform: any, selected: boolean): void {
    if (selected) {
      this.drawSelection();
    }
    const ctx = this.ctx;
    ctx.beginPath();
    const zoomResetScale = 1 / transform.scale(1).k;

      // Node shape
    ctx.save();
    (ctx as any).rect(
        this.boundingBox.minX,
        this.boundingBox.minY,
        this.width,
        this.height,
    );

    drawStrokeAndFill(ctx, this.shapeFillColor);
    drawStroke(ctx, this.stroke, zoomResetScale);

    ctx.restore();

    // Group label - above the group
    this.textbox.drawCenteredAt(this.x, this.y - (this.height / 2) - this.LABEL_OFFSET -
      this.textbox.actualHeightWithInsets / 2.0 - zoomResetScale * ctx.lineWidth);
  }

  drawSelection() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.save();
    const {x, y, width, height} = getRectWithMargin(this.boundingBox, this.selectionMargin);
    ctx.rect(x, y, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
    ctx.fill();
    ctx.restore();
  }

  getBoundingBox(): BoundingBox {
    return this.boundingBox;
  }

  isBBoxEnclosing(bbox: BoundingBox): boolean {
    return isBBoxEnclosing(bbox, this.getBoundingBox());
  }

  isPointIntersecting({x, y}: Point): boolean {
    return x >= this.boundingBox.minX &&
           x <= this.boundingBox.maxX &&
           y >= this.boundingBox.minY &&
           y <= this.boundingBox.maxY;
  }

}
