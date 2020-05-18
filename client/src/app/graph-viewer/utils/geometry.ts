import intersects from 'intersects';

// TODO: Clean up / find an alternative
export function pointOnRect(x, y, minX, minY, maxX, maxY, validate) {
  if (validate && (minX < x && x < maxX) && (minY < y && y < maxY)) {
    return {x, y};
  }
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  // if (midX - x == 0) -> m == ±Inf -> minYx/maxYx == x (because value / ±Inf = ±0)
  const m = (midY - y) / (midX - x);

  if (x <= midX) { // check "left" side
    const minXy = m * (minX - x) + y;
    if (minY <= minXy && minXy <= maxY) {
      return {x: minX, y: minXy};
    }
  }

  if (x >= midX) { // check "right" side
    const maxXy = m * (maxX - x) + y;
    if (minY <= maxXy && maxXy <= maxY) {
      return {x: maxX, y: maxXy};
    }
  }

  if (y <= midY) { // check "top" side
    const minYx = (minY - y) / m + x;
    if (minX <= minYx && minYx <= maxX) {
      return {x: minYx, y: minY};
    }
  }

  if (y >= midY) { // check "bottom" side
    const maxYx = (maxY - y) / m + x;
    if (minX <= maxYx && maxYx <= maxX) {
      return {x: maxYx, y: maxY};
    }
  }

  // edge case when finding midpoint intersection: m = 0/0 = NaN
  if (x === midX && y === midY) {
    return {x, y};
  }

  // Should never happen :) If it does, please tell me!
  return {x, y};
}

// TODO: Clean up
export function getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) {
  if (!intersects.pointLine(x, y, x1, y1, x2, y2)) {
    return Infinity;
  }
  const expectedSlope = (y2 - y1) / (x2 - x1);
  const slope = (y - y1) / (x - x1);
  return Math.abs(slope - expectedSlope);
}
