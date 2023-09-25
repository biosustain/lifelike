import { partial as _partial } from 'lodash/fp';
import { Observable } from 'rxjs';

import { callbackBatchIterate, Deadline } from './callback-batch-iterate';

export const animationFrameBatchIterate: <T>(
  generator: () => IterableIterator<T>
) => Observable<T[]> = _partial(callbackBatchIterate, [
  (callback: (deadline: Deadline) => void) =>
    requestAnimationFrame((startTime) =>
      callback({
        timeRemaining: () => 1e3 / 30 - (performance.now() - startTime),
      })
    ),
  cancelAnimationFrame,
]);
