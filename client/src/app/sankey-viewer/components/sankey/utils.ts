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
    hue = (i, n) => 360 * i / n,
    saturation = (_i, _n) => 0.75,
    lightness = (_i, _n) => 0.75,
    alpha = (_i, _n) => 0.75
  } = {}
) =>
  i => `hsla(${hue(i, size)},${100 * saturation(i, size)}%,${100 * lightness(i, size)}%,${alpha(i, size)})`;

export const createMapToColor = (arr, ...rest) => {
  const uniq = arr instanceof Set ? arr : new Set(arr);
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

export const calculateLinkPathParams = (link, normalize = true) => {
  const {source, target, multiple_values} = link;
  let {value: linkValue} = link;
  linkValue = linkValue || 1e-4;
  const sourceX = source.x1;
  const targetX = target.x0;
  const {sourceLinks} = source;
  const {targetLinks} = target;
  const sourceIndex = sourceLinks.indexOf(link);
  const targetIndex = targetLinks.indexOf(link);
  // tslint:disable-next-line:no-bitwise
  const bezierX = (sourceX + targetX) / 2;
  let sourceY0;
  let sourceY1;
  let targetY0;
  let targetY1;
  let sourceY = 0;
  let targetY = 0;

  if (multiple_values) {
    for (let i = 0; i < sourceIndex; i++) {
      sourceY += sourceLinks[i].multiple_values[0];
    }
    for (let i = 0; i < targetIndex; i++) {
      targetY += targetLinks[i].multiple_values[1];
    }
  } else {
    for (let i = 0; i < sourceIndex; i++) {
      sourceY += sourceLinks[i].value;
    }
    for (let i = 0; i < targetIndex; i++) {
      targetY += targetLinks[i].value;
    }
  }

  if (normalize) {
    let sourceValues;
    let targetValues;
    if (multiple_values) {
      sourceValues = sourceLinks.map(({multiple_values: [value]}) => value);
      targetValues = targetLinks.map(({multiple_values: [_, value]}) => value);
    } else {
      sourceValues = sourceLinks.map(({value}) => value);
      targetValues = targetLinks.map(({value}) => value);
    }
    const sourceNormalizer = sourceLinks.normalizer || (sourceLinks.normalizer = normalizeGenerator(sourceValues));
    const targetNormalizer = targetLinks.normalizer || (targetLinks.normalizer = normalizeGenerator(targetValues));
    const sourceHeight = source.y1 - source.y0;
    const targetHeight = target.y1 - target.y0;
    // tslint:disable-next-line:no-bitwise
    sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + source.y0;
    // tslint:disable-next-line:no-bitwise
    targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + target.y0;
    if (multiple_values) {
      // tslint:disable-next-line:no-bitwise
      sourceY1 = (sourceNormalizer.normalize(multiple_values[0]) * sourceHeight) + sourceY0;
      // tslint:disable-next-line:no-bitwise
      targetY1 = (targetNormalizer.normalize(multiple_values[1]) * targetHeight) + targetY0;
    } else {
      // tslint:disable-next-line:no-bitwise
      sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
      // tslint:disable-next-line:no-bitwise
      targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
    }
  } else {
    let {width} = link;
    width = width || 1e-4;
    const valueScaler = width / linkValue;

    // tslint:disable-next-line:no-bitwise
    sourceY0 = sourceY * valueScaler + source.y0;
    // tslint:disable-next-line:no-bitwise
    targetY0 = targetY * valueScaler + target.y0;
    if (multiple_values) {
      // tslint:disable-next-line:no-bitwise
      sourceY1 = multiple_values[0] * valueScaler + sourceY0;
      // tslint:disable-next-line:no-bitwise
      targetY1 = multiple_values[1] * valueScaler + targetY0;
    } else {
      // tslint:disable-next-line:no-bitwise
      sourceY1 = linkValue * valueScaler + sourceY0;
      // tslint:disable-next-line:no-bitwise
      targetY1 = linkValue * valueScaler + targetY0;
    }
  }
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

export const clamp = (min, max) => value => Math.min(Math.max(min, Number(value)), max);
export const RELAYOUT_DURATION = 250;
export const INITIALLY_SHOWN_CHARS = 10;
export const nodeLabelAccessor = ({displayName}) => displayName;
export const shortNodeText = n => nodeLabelAccessor(n).slice(0, INITIALLY_SHOWN_CHARS);
export const christianColors = [
  '#1CE6FF', '#FF34FF', '#FF4A46', '#008941', '#006FA6', '#A30059', '#FFFF00',
  '#FFDBE5', '#7A4900', '#0000A6', '#63FFAC', '#B79762', '#004D43', '#8FB0FF', '#997D87',
  '#5A0007', '#809693', '#FEFFE6', '#1B4400', '#4FC601', '#3B5DFF', '#4A3B53', '#FF2F80',
  '#61615A', '#BA0900', '#6B7900', '#00C2A0', '#FFAA92', '#FF90C9', '#B903AA', '#D16100',
  '#DDEFFF', '#000035', '#7B4F4B', '#A1C299', '#300018', '#0AA6D8', '#013349', '#00846F',
  '#372101', '#FFB500', '#C2FFED', '#A079BF', '#CC0744', '#C0B9B2', '#C2FF99', '#001E09',
  '#00489C', '#6F0062', '#0CBD66', '#EEC3FF', '#456D75', '#B77B68', '#7A87A1', '#788D66',
  '#885578', '#FAD09F', '#FF8A9A', '#D157A0', '#BEC459', '#456648', '#0086ED', '#886F4C',
  '#34362D', '#B4A8BD', '#00A6AA', '#452C2C', '#636375', '#A3C8C9', '#FF913F', '#938A81',
  '#575329', '#00FECF', '#B05B6F', '#8CD0FF', '#3B9700', '#04F757', '#C8A1A1', '#1E6E00',
  '#7900D7', '#A77500', '#6367A9', '#A05837', '#6B002C', '#772600', '#D790FF', '#9B9700',
  '#549E79', '#FFF69F', '#201625', '#72418F', '#BC23FF', '#99ADC0', '#3A2465', '#922329',
  '#5B4534', '#FDE8DC', '#404E55', '#0089A3', '#CB7E98', '#A4E804', '#324E72', '#6A3A4C',
  '#83AB58', '#001C1E', '#D1F7CE', '#004B28', '#C8D0F6', '#A3A489', '#806C66', '#222800',
  '#BF5650', '#E83000', '#66796D', '#DA007C', '#FF1A59', '#8ADBB4', '#1E0200', '#5B4E51',
  '#C895C5', '#320033', '#FF6832', '#66E1D3', '#CFCDAC', '#D0AC94', '#7ED379', '#012C58'];

export const representativePositiveNumber = clamp(Number.MIN_VALUE, 1e4);

