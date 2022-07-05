interface RectPosition {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const getBoundingRect = (rects: RectPosition[]) => {
  let ex0 = +Infinity;
  let ex1 = -Infinity;
  let ey0 = +Infinity;
  let ey1 = -Infinity;
  for (const {x0, x1, y0, y1} of rects) {
    ex0 = Math.min(ex0, x0);
    ex1 = Math.max(ex1, x1);
    ey0 = Math.min(ey0, y0);
    ey1 = Math.max(ey1, y1);
  }
  return {
    x0: ex0,
    x1: ex1,
    y0: ey0,
    y1: ey1
  };
};
