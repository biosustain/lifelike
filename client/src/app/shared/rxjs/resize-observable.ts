import { Observable, animationFrameScheduler } from 'rxjs';
import { throttleTime, distinctUntilChanged, filter, share } from 'rxjs/operators';
import { isEqual } from 'lodash-es';

import { debug } from './debug';
import { ExtendedWeakMap } from '../utils/types';

/**
 * Returns observable of native element size (might be constant even if window resizes)
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
    const ro = new ResizeObserver(() => {
      const size = element.getBoundingClientRect();
      subscriber.next(size);
      const updatedSize = element.getBoundingClientRect();
      if (size.width !== updatedSize.width) {
        // If the container size shrank during resize, let's assume
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
    debug('resize-observable'),
    // Do no resize if not displayed
    filter<DOMRect>(({width, height}) => width !== 0 && height !== 0),
    share()
  );
}

interface Size {
  width: number;
  height: number;
}

export function createWindowResizeObservable(options?: boolean | AddEventListenerOptions): Observable<Size> {
  return new Observable<Size>(subscriber => {
    const listener: Parameters<EventTarget['addEventListener']> = [
      'resize',
      () => subscriber.next({
        width: window.innerWidth,
        height: window.innerHeight
      })
    ];
    if (options) {
      listener.push(options);
    }
    window.addEventListener(...listener);
    return function unsubscribe() {
      window.removeEventListener(...listener);
    };
  }).pipe(
    // Do not return value more often than once per frame
    throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
    // Only actual change
    distinctUntilChanged(isEqual),
    debug('window-resize-observable'),
    // Do no resize if not displayed
    filter<Size>(({width, height}) => width !== 0 && height !== 0),
    share()
  );
}

export const windowResizeObservable = createWindowResizeObservable();
