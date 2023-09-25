import { NgZone } from '@angular/core';

import { Observable } from 'rxjs';

/**
 * Operator to run observable in Angular zone.
 * @param ngZone - Angular zone to run observable in.
 */
export function runInAngularZone(ngZone: NgZone) {
  return <T>(source: Observable<T>) =>
    new Observable<T>(
      (observer) =>
        source.subscribe({
          next(x) {
            ngZone.run(() => observer.next(x));
          },
          error(err) {
            ngZone.run(() => observer.error(err));
          },
          complete() {
            ngZone.run(() => observer.complete());
          },
        }).unsubscribe
    );
}
