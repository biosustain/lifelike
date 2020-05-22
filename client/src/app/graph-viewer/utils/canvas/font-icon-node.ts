import { PlacedNode } from '../../styles/graph-styles';
import { CanvasTextbox } from './canvas-textbox';

export interface IconNodeOptions {
  x: number;
  y: number;
  iconTextbox: CanvasTextbox;
  labelTextbox: CanvasTextbox;
  forceHighDetailLevel?: boolean;
}

/**
 * Draw a font icon and a label below it.
 */
export class FontIconNode implements PlacedNode {
  readonly x: number;
  readonly y: number;
  readonly iconTextbox: CanvasTextbox;
  readonly labelTextbox: CanvasTextbox;
  readonly forceHighDetailLevel = false;

  readonly minimumBBoxSize = 10;

  readonly yShift = 7; // Older renderer was a little off?
  readonly iconLabelSpacing = 2;
  readonly totalHeight: number;
  readonly minY: number;
  readonly bbox: {minX: number, minY: number, maxX: number, maxY: number};

  constructor(private ctx: CanvasRenderingContext2D, options: IconNodeOptions) {
    Object.assign(this, options);
    this.totalHeight = this.iconTextbox.actualHeight
      + this.iconLabelSpacing
      + this.labelTextbox.actualHeight;
    this.minY = this.y - (this.totalHeight / 2);

    const bboxWidth = Math.max(this.labelTextbox.actualWidth, this.iconTextbox.actualWidth, this.minimumBBoxSize);
    const bboxHeight = Math.max(this.totalHeight, this.minimumBBoxSize);
    this.bbox = {
      minX: this.x - bboxWidth / 2,
      minY: this.minY + this.yShift,
      maxX: this.x + bboxWidth / 2,
      maxY: this.minY + bboxHeight + this.yShift,
    };
  }

  getBoundingBox() {
    return this.bbox;
  }

  isPointIntersecting(x: number, y: number): boolean {
    // What if the text doesn't render or it's too small? Then the user
    // can't select this node anymore, which is bad
    const clickableIconTextWidth = Math.max(this.iconTextbox.actualWidth, 50);

    return (
      // Check intersection with the icon
      x >= this.x - clickableIconTextWidth / 2 &&
      x <= this.x + clickableIconTextWidth / 2 &&
      y >= this.minY &&
      y <= this.minY + this.totalHeight
    ) || (
      // Check intersection with the text
      x >= this.x - this.labelTextbox.actualWidth / 2 &&
      x <= this.x + this.labelTextbox.actualWidth / 2 &&
      y >= this.minY + this.iconTextbox.actualHeight + this.iconLabelSpacing &&
      y <= this.minY + this.totalHeight
    );
  }

  lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
    // TODO: Polygonal intersection because we have an icon 'head' and a text 'body'
    return [this.x, this.y];
  }

  draw(transform: any): void {
    const ctx = this.ctx;
    const highDetailLevel = transform.k >= 0.35 || this.forceHighDetailLevel;

    ctx.save();
    ctx.beginPath();

    // Draw icon
    this.iconTextbox.draw(
      this.x - this.iconTextbox.actualWidth / 2,
      this.minY + this.iconTextbox.actualHeight / 2 - this.yShift,
    );

    // Either draw the text or draw a box representing the text
    if (highDetailLevel) {
      this.labelTextbox.draw(
        this.x - this.labelTextbox.actualWidth / 2,
        this.minY + this.iconTextbox.actualHeight + this.iconLabelSpacing
        + this.labelTextbox.actualHeight / 2
        + this.labelTextbox.lineMetrics.actualBoundingBoxAscent
        - this.yShift,
      );
    } else {
      ctx.fillStyle = '#ccc';
      // TODO: Y offset wrong
      ctx.fillRect(
        this.x - this.labelTextbox.actualWidth / 2,
        this.minY + this.iconTextbox.actualHeight + this.iconLabelSpacing + this.labelTextbox.actualHeight / 2 + this.yShift,
        this.labelTextbox.actualWidth,
        this.labelTextbox.actualHeight
      );
    }

    ctx.restore();
  }
}
