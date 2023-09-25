import { partial as _partial } from 'lodash/fp';
import { animationFrameScheduler, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { animationFrameBatchIterate } from './animation-frame';
import { callbackBatchIterate, Deadline } from './callback-batch-iterate';

interface IdleDeadline extends Deadline {
  didTimeout: boolean;
}

export interface IdleRequestOptions {
  timeout: number;
}

/**
 * Return single value observable which waits for browser beeing idle or timeout running out
 * @param timeout - in ms
 */
export function idle(
  idleRequestOptions: IdleRequestOptions = { timeout: 100 }
): Observable<IdleDeadline> {
  return new Observable((observer) => {
    // requestIdleCallback hasn't been typed in current typescript version (3.8.3)
    // TODO: update once we update to 4.4
    if ((window as any).requestIdleCallback) {
      const handle = (window as any).requestIdleCallback(() => {
        observer.next();
        observer.complete();
      }, idleRequestOptions);
      return () => (window as any).cancelIdleCallback(handle);
    }
    observer.next();
    observer.complete();
  });
}

export const idleBatchIterate: <T>(
  generator: () => IterableIterator<T>,
  options?: IdleRequestOptions
) => Observable<T[]> = (window as any).requestIdleCallback
  ? _partial(callbackBatchIterate, [
      (window as any).requestIdleCallback.bind(window),
      (window as any).cancelIdleCallback.bind(window),
    ])
  : animationFrameBatchIterate;
