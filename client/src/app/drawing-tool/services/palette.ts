// TODO: Index these and provide a standard swappable palette
export const PALETTE_COLORS = Object.freeze([
  '#d62728',
  '#ff9800',
  '#edc949',
  '#bcbd22',
  '#4caf50',
  '#17becf',
  '#0277bd',
  '#673ab7',
  '#e377c2',
  '#CCCCCC',
  '#7f7f7f',
  '#000000',
]);

// 4d - 30% opacity
export const BG_OPACITY = '4d';

export const BG_PALETTE_COLORS = Object.freeze(
  PALETTE_COLORS.map((colorString) => colorString + BG_OPACITY)
);
