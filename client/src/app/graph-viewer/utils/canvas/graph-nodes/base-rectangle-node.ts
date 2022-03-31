import { PlacedNode } from 'app/graph-viewer/styles/styles';

import { pointOnRect } from '../../geometry';
import { BoundingBox, isBBoxEnclosing } from '../../behaviors/abstract-node-handle-behavior';

export interface BaseRectangleNodeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
}

export abstract class BaseRectangleNode extends PlacedNode {

  protected defaultWidth = 100;
  protected defaultHeight = 100;
  readonly padding: number = 10;

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  nodeWidth: number;
  nodeHeight: number;
  readonly nodeX: number;
  readonly nodeY: number;
  readonly nodeX2: number;
  readonly nodeY2: number;

  constructor(protected readonly ctx: CanvasRenderingContext2D, options: BaseRectangleNodeOptions) {
    super();
    Object.assign(this, options);

    this.nodeWidth = (this.width != null ? this.width : this.defaultWidth) + this.padding;
    this.nodeHeight = (this.height != null ? this.height : this.defaultHeight) + this.padding;
    this.nodeX = this.x - this.nodeWidth / 2;
    this.nodeY = this.y - this.nodeHeight / 2;
    this.nodeX2 = this.nodeX + this.nodeWidth;
    this.nodeY2 = this.nodeY + this.nodeHeight;
  }

  getBoundingBox(): BoundingBox {
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

  isBBoxEnclosing(bbox: BoundingBox): boolean {
    return isBBoxEnclosing(bbox, this.getBoundingBox());
  }

  lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
    const {x, y} = pointOnRect(
      lineOriginX,
      lineOriginY,
      this.nodeX,
      this.nodeY,
      this.nodeX2,
      this.nodeY2,
      true,
    );
    return [x, y];
  }


}
