import { MonoTypeOperatorFunction, Observable, throwError } from 'rxjs';
import { first, retryWhen, share, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';

import { isOfflineError } from '../exceptions';

/**Returns observable of browser online status
 */
export const onlineChangeObservable = new Observable<boolean>((subscriber) => {
  // event callback into stream containing events
  const changeOnline = (e) => subscriber.next(true);
  const changeOffline = (e) => subscriber.next(false);

  // listen on scroll event
  window.addEventListener('online', changeOnline);
  // as well as on wheel move (trigger even if set on child of scrolled element)
  window.addEventListener('offline', changeOffline);

  return function unsubscribe() {
    window.removeEventListener('online', changeOnline);
    window.removeEventListener('offline', changeOffline);
  };
}).pipe(
  tap((online) => console.log(`Changed to ${online ? 'online' : 'offline'} status.`)),
  share()
);

export const onlineObservable = onlineChangeObservable.pipe(
  startWith(navigator.onLine),
  shareReplay()
);

// Most get requests can be reruned when we get online
export function retryWhenOnline<T>(): MonoTypeOperatorFunction<T> {
  return retryWhen<T>((errors) =>
    errors.pipe(
      switchMap((error) => {
        if (isOfflineError(error)) {
          console.warn('Request send while offline, waiting for online status');
          return onlineChangeObservable.pipe(
            first() // retry only on first change
          );
        } else {
          return throwError(error);
        }
      })
    )
  );
}
