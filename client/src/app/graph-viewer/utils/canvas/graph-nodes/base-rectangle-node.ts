import { PlacedNode } from 'app/graph-viewer/styles/styles';

import { pointOnRect } from '../../geometry';
import { BoundingBox, getRectWithMargin, isBBoxEnclosing, Point } from '../shared';

export interface BaseRectangleNodeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
}

export abstract class BaseRectangleNode extends PlacedNode {

  protected readonly DEFAULT_WIDTH = 100;
  protected readonly DEFAULT_HEIGHT = 100;
  protected readonly padding = 10;

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  nodeWidth: number;
  nodeHeight: number;
  readonly bbox: BoundingBox;

  constructor(protected readonly ctx: CanvasRenderingContext2D, options: BaseRectangleNodeOptions) {
    super();
    Object.assign(this, options);

    this.nodeWidth = (this.width ?? this.DEFAULT_WIDTH) + this.padding;
    this.nodeHeight = ( this.height ?? this.DEFAULT_HEIGHT) + this.padding;
    const minX = this.x - this.nodeWidth / 2;
    const minY = this.y - this.nodeHeight / 2;
    const maxX = minX + this.nodeWidth;
    const maxY = minY + this.nodeHeight;
    this.bbox = {minX, minY, maxX, maxY};
  }

  drawSelection() {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.save();
    const {x, y, width, height} = getRectWithMargin(this.bbox, this.selectionMargin);
    ctx.rect(x, y, width, height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
    ctx.fill();
    ctx.restore();

  }

  getBoundingBox(): BoundingBox {
    return this.bbox;
  }

  isPointIntersecting({x, y}: Point): boolean {
    return x >= this.bbox.minX && x <= this.bbox.maxX && y >= this.bbox.minY && y <= this.bbox.maxY;
  }

  isBBoxEnclosing(bbox: BoundingBox): boolean {
    return isBBoxEnclosing(bbox, this.getBoundingBox());
  }

  lineIntersectionPoint(lineOrigin: Point): Point {
    return pointOnRect(
      lineOrigin,
      this.bbox,
      true,
    );
  }


}
