import { Observable, animationFrameScheduler } from 'rxjs';
import { throttleTime, distinctUntilChanged, filter, share, map, tap } from 'rxjs/operators';
import { isEqual, partialRight, mapValues } from 'lodash-es';

/**
 * Returns observable of native element size (might be constant event if window resizes)
 *
 * The sizing value is:
 * + throttled with animation frames
 * + updates only upon change
 * + skips updates when `display: none;`
 *
 * @param element - DOM element to observe
 */
export function createResizeObservable(element: HTMLElement): Observable<DOMRectReadOnly> {
  return new Observable<DOMRectReadOnly>(subscriber => {
    // @ts-ignore there is not type definition for ResizeObserver in Angular
    const ro = new ResizeObserver(([{contentRect}]: ResizeObserverEntry[]) => {
      subscriber.next(contentRect);
      const updatedSize = element.getBoundingClientRect();
      if (Math.abs(contentRect.width - updatedSize.width) > 1) {
        // If the container size significantly shrank during resize, let's assume
        // scrollbar appeared. So we resize again with the scrollbar visible -
        // potentially making container smaller and the scrollbar hidden again.
        subscriber.next(updatedSize);
      }
    });

    // Observe one or multiple elements
    ro.observe(element);
    return function unsubscribe() {
      ro.unobserve(element);
      ro.disconnect();
    };
  }).pipe(
    // Do not return value more often than once per frame
    throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
    // Only actual change
    distinctUntilChanged(isEqual),
    // Do no resize if not displayed
    filter(({width, height}) => width !== 0 && height !== 0),
    share()
  );
}
