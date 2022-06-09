import { assign } from 'lodash-es';

import { aggregate } from 'app/shared/utils/collection';

export interface RectPositionInterface {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

type RectPositionSource = RectPositionInterface | Element | SVGGraphicsElement | DOMRect;

class RectPosition {
  x0: number;
  x1: number;
  y0: number;
  y1: number;

  constructor(rect: RectPositionInterface) {
    assign(this, rect);
  }

  get width() {
    return this.x1 - this.x0;
  }

  get height() {
    return this.y1 - this.y0;
  }

  static from(value: RectPositionSource): RectPositionInterface {
    if (value instanceof RectPosition) {
      return value;
    }
    if (value instanceof SVGGraphicsElement) {
      return RectPosition.from(value.getBBox());
    }
    if (value instanceof Element) {
      return RectPosition.from(value.getBoundingClientRect());
    }
    const {x, y, width, height} = (value as DOMRect);
    const {x0 = x, y0 = y, x1 = x + width, y1 = y + height} = (value as RectPositionInterface);
    return new RectPosition({x0, y0, x1, y1});
  }
}

const agregationMappingRectPosition = {
  x0: Math.min,
  y0: Math.min,
  x1: Math.max,
  y1: Math.max
};

export const getBoundingRect = (rects: RectPositionInterface[]) =>
  aggregate(
    rects,
    agregationMappingRectPosition
  );

getBoundingRect.from = (rects) =>
  getBoundingRect(
    rects.map(rect => RectPosition.from(rect))
  );
