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

/**
 * Throttles calling `fn` once per animation frame
 * Latest arguments are used on the actual call
 * @param fn - function which calls should be throttled
 */
export function throttled(fn: (...r: any[]) => void) {
  let ticking = false;
  let args = [];
  return (...rest) => {
    args = Array.prototype.slice.call(rest);
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        fn.apply(window, args);
      });
    }
  };
}

export const calculateLinkPathParams = link => {
  const {value: linkValue, source, target} = link;
  const {sourceLinks} = source;
  const {targetLinks} = target;
  const sourceValues = sourceLinks.map(({value}) => value);
  const targetValues = targetLinks.map(({value}) => value);
  const sourceIndex = sourceLinks.indexOf(link);
  const targetIndex = targetLinks.indexOf(link);
  const sourceNormalizer = sourceLinks.normalizer || (sourceLinks.normalizer = normalizeGenerator(sourceValues));
  const targetNormalizer = targetLinks.normalizer || (targetLinks.normalizer = normalizeGenerator(targetValues));
  const sourceX = source.x1;
  const targetX = target.x0;
  let sourceY = 0;
  let targetY = 0;
  for (let i = 0; i < sourceIndex; i++) {
    sourceY += sourceLinks[i].value;
  }
  for (let i = 0; i < targetIndex; i++) {
    targetY += targetLinks[i].value;
  }
  const sourceHeight = source.y1 - source.y0;
  const targetHeight = target.y1 - target.y0;
  // tslint:disable-next-line:no-bitwise
  const sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + source.y0;
  // tslint:disable-next-line:no-bitwise
  const targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + target.y0;
  // tslint:disable-next-line:no-bitwise
  const sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
  // tslint:disable-next-line:no-bitwise
  const targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
  // tslint:disable-next-line:no-bitwise
  const bezierX = (sourceX + targetX) / 2;
  return {
    sourceX,
    sourceY0,
    sourceY1,
    targetX,
    targetY0,
    targetY1,
    bezierX
  };
};
export const composeLinkPath = ({
                                  sourceX,
                                  sourceY0,
                                  sourceY1,
                                  targetX,
                                  targetY0,
                                  targetY1,
                                  bezierX
                                }) =>
  `M${sourceX} ${sourceY0}` +
  `C${bezierX} ${sourceY0},${bezierX} ${targetY0},${targetX} ${targetY0}` +
  `L${targetX} ${targetY1}` +
  `C${bezierX} ${targetY1},${bezierX} ${sourceY1},${sourceX} ${sourceY1}` +
  `Z`;
export const layerWidth = ({source, target}) => Math.abs(target.layer - source.layer);
export const createResizeObserver = (callback, container) => {
  const resize = throttled(async (width, height) => {
    const w = container.clientWidth;
    await callback(width, height - 42);
    if (w < container.clientWidth) {
      // If the container size shrank during chart resize, let's assume
      // scrollbar appeared. So we resize again with the scrollbar visible -
      // effectively making chart smaller and the scrollbar hidden again.
      // Because we are inside `throttled`, and currently `ticking`, scroll
      // events are ignored during this whole 2 resize process.
      // If we assumed wrong and something else happened, we are resizing
      // twice in a frame (potential performance issue)
      await callback(container.offsetWidth, container.offsetHeight - 42);
    }
  });

  // @ts-ignore until https://github.com/microsoft/TypeScript/issues/37861 implemented
  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    const width = entry.contentRect.width;
    const height = entry.contentRect.height;
    // When its container's display is set to 'none' the callback will be called with a
    // size of (0, 0), which will cause the chart to lost its original height, so skip
    // resizing in such case.
    if (width === 0 && height === 0) {
      return;
    }
    resize(width, height);
  });
  // todo
  observer.observe(container);
  return observer;
};

export interface SankeyGraph {
  links: any[];
  nodes: any[];
  graph: any;
}

export const clamp = (min, max) => value => Math.min(Math.max(min, value), max);
