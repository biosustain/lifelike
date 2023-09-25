import { Subject } from 'rxjs';

import { promiseOfOne } from './to-promise';

export function updateSubject<V>(
  subject: Subject<V>,
  updateCallback: (value: V) => V | Promise<V>
) {
  return promiseOfOne(subject)
    .then(updateCallback)
    .then((value) => {
      subject.next(value);
      return value;
    });
}
