import { Observable, animationFrameScheduler, merge } from 'rxjs';
import { throttleTime, distinctUntilChanged, share } from 'rxjs/operators';

import { ExtendedWeakMap } from '../utils/types';

const globalObservables = new ExtendedWeakMap<GlobalEventHandlers, Observable<Event>>();

const SCROLL_PARAMS = ['offsetTop', 'scrollTop', 'offsetLeft', 'scrollLeft'];

function scrollParamsCompare<Ev extends Event>(a: Ev, b: Ev): boolean {
  return SCROLL_PARAMS.every(param => a.target[param] === b.target[param]);
}

/**Returns observable of native elements scroll events
 * The events are:
 * + throttled with animation frames
 * + updates only upon change
 * Tip: usually we are interested in scroll events of element as well as global ones call on window.
 *      to do so call this function as createScrollObservable(element, window)
 * @param elements - DOM elements to observe
 * @returns Observable list of elements offsetTop, scrollTop, offsetLeft, scrollLeft
 */
export function createScrollObservable(...elements: GlobalEventHandlers[]) {
  return merge(
    // for each element create scroll observable
    ...elements.map(element =>

      // unless we already have it and it is not garbage collected
      globalObservables.getSetLazily(element, () =>

        // actual creation code
        new Observable<Event>(subscriber => {
          // event callback into stream containing events
          const scroll = e => subscriber.next(e);

          // listen on scroll event
          element.addEventListener('scroll', scroll);
          // as well as on wheel move (trigger even if set on child of scrolled element)
          element.addEventListener('wheel', scroll);

          return function unsubscribe() {
            element.removeEventListener('scroll', scroll);
            element.removeEventListener('wheel', scroll);
          };
        })
      ).pipe(
        // Only actual change compared by revelant scroll params
        distinctUntilChanged(scrollParamsCompare),
      )
    )
  ).pipe(
    // Do not return value more often than once per frame
    throttleTime(0, animationFrameScheduler, {leading: true, trailing: true}),
    share()
  );
}
