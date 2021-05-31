export const normalizeGenerator = values => {
  const min = Math.min(...values);
  const max = values.reduce((o, n) => o + n, 0);
  return {
    min, max,
    normalize: (max - min) ? d => Math.max(0, d / max) : d => d / max
  };
};

export const colorPalletGenerator = (
  size,
  {
    hue = (i, n) => 360 * (i % 2 ? i : n - 2) / n,
    saturation = (_i, _n) => 0.75,
    lightness = (_i, _n) => 0.75,
    alpha = (_i, _n) => 0.75
  } = {}
) =>
  i => `hsla(${360 * hue(i, size)},${100 * saturation(i, size)}%,${100 * lightness(i, size)}%,${alpha(i, size)})`;

export const createMapToColor = (arr, ...rest) => {
  const uniq = new Set(arr);
  const palette = colorPalletGenerator(uniq.size, ...rest);
  return new Map([...uniq].map((v, i) => [v, palette(i)]));
};
