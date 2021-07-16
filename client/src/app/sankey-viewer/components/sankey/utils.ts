import { uniqueBy, nodeLabelAccessor } from '../utils';
import { isDevMode } from '@angular/core';

export const normalizeGenerator = values => {
  const min = Math.min(...values);
  const max = values.reduce((o, n) => o + n, 0);
  return {
    min, max,
    normalize: (max - min) ? d => Math.max(0, d / max) : d => d / max
  };
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
  const columns = Math.abs(target.column - source.column);
  const linkWidth = Math.abs(targetX - sourceX);
  const bezierOffset = (link.circular ? linkWidth / columns : linkWidth) / 2;
  const sourceBezierX = sourceX + bezierOffset;
  const targetBezierX = targetX - bezierOffset;
  if (isDevMode()) {
    console.assert(
      link.circular || (sourceBezierX === targetBezierX),
      'Non circular bezier s/t should equal at average',
      sourceBezierX, '(source bez) ===',
      targetBezierX, '(target bez) ===',
      (sourceX + targetX) / 2, '(average)'
    );
  }
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
    sourceBezierX,
    targetBezierX
  };
};
export const composeLinkPath = ({
                                  sourceX,
                                  sourceY0,
                                  sourceY1,
                                  targetX,
                                  targetY0,
                                  targetY1,
                                  sourceBezierX,
                                  targetBezierX
                                }) =>
  `M${sourceX} ${sourceY0}` +
  `C${sourceBezierX} ${sourceY0},${targetBezierX} ${targetY0},${targetX} ${targetY0}` +
  `L${targetX} ${targetY1}` +
  `C${targetBezierX} ${targetY1},${sourceBezierX} ${sourceY1},${sourceX} ${sourceY1}` +
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

export const RELAYOUT_DURATION = 250;
export const INITIALLY_SHOWN_CHARS = 10;
export const shortNodeText = n => nodeLabelAccessor(n).slice(0, INITIALLY_SHOWN_CHARS);


export function symmetricDifference(setA, setB, accessor) {
  return [...uniqueBy(setB, accessor).entries()].reduce((difference, [identifier, elem]) => {
    if (difference.has(identifier)) {
      difference.delete(identifier);
    } else {
      difference.set(identifier, elem);
    }
    return difference;
  }, uniqueBy(setA, accessor));
}
