import { uniqueBy } from '../utils';

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

export const createResizeObserver = (callback, container) => {
  let prevWidth;
  let prevHeight;
  const resize = throttled(async (width, height) => {
    if (width !== prevWidth || height !== prevHeight) {
      const w = container.clientWidth;
      await callback(width, height);
      if (w < container.clientWidth) {
        // If the container size shrank during chart resize, let's assume
        // scrollbar appeared. So we resize again with the scrollbar visible -
        // effectively making chart smaller and the scrollbar hidden again.
        // Because we are inside `throttled`, and currently `ticking`, scroll
        // events are ignored during this whole 2 resize process.
        // If we assumed wrong and something else happened, we are resizing
        // twice in a frame (potential performance issue)
        await callback(container.offsetWidth, container.offsetHeight);
      }
    }
    prevWidth = width;
    prevHeight = height;
  });

  // @ts-ignore until https://github.com/microsoft/TypeScript/issues/37861 implemented
  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    const width = Math.round(entry.contentRect.width);
    const height = Math.round(entry.contentRect.height);
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
