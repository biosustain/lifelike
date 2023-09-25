import { ArgumentType } from '@angular/compiler/src/core';
import { Optional } from '@angular/core';

import { Observable } from 'rxjs';
import { partial as _partial } from 'lodash/fp';

/**
 * Given result generator iterate it leveraging callbacks API
 * Upon request callback get as many results as possible and return them in batch.
 * @param request - callback in which we fetch batch of results (provided deadline)
 * @param cancel - callback to cancel waiting for request callback
 * @param generator - factory returning iterator doing work on each .next call
 * @param options - optional parameters used to make request
 */
export function callbackBatchIterate<T extends any, R extends RequestCallback>(
  request: R,
  cancel: CancelCallback,
  generator: () => IterableIterator<T>,
  options?: R extends (callback: (deadline: Deadline) => void, options?: infer Options) => number
    ? Options
    : never
): Observable<T[]> {
  return new Observable((subscriber) => {
    const findQueue = generator();
    let handle: number | undefined;
    const findNext = _partial(request, [
      (idleDeadline: Deadline) => {
        const startTime = performance.now();
        let n = 0;
        const batch = [];
        do {
          const next = findQueue.next();
          if (next.done) {
            subscriber.next(batch);
            subscriber.complete();
            return;
          } else {
            batch.push(next.value);
          }
          n++;
        } while (idleDeadline.timeRemaining() > (performance.now() - startTime) / n);
        subscriber.next(batch);
        handle = findNext();
      },
      options,
    ]);
    handle = findNext();
    return () => (handle ? cancel(handle) : undefined);
  });
}

export interface Deadline {
  /**
   * Get time remaining in ms until iteration should be finished
   */
  timeRemaining: () => number;
}

type RequestCallback = (callback: (deadline: Deadline) => void, ...options) => number;
type CancelCallback = (handle: number) => void;
