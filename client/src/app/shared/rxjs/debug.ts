// @ts-nocheck
import { isDevMode } from '@angular/core';

import { tap, finalize } from 'rxjs/operators';

import { skipStep } from './skipStep';

const statusMessage = ({level, label, id, bgColor, color}) => (...args) => console[level](
  `%c%s%c %s${args.length ? ':' : ''}%c`,
  `background-color: ${bgColor}; color: ${color}; padding: 2px 4px;`,
  label.toUpperCase(),
  `background-color: initial; font-weight: bold;`,
  id,
  `font-weight: initial;`,
  ...args
);

const init = params => statusMessage({
  label: 'init', level: 'debug', bgColor: 'deeppink', color: 'white', ...params
});
const updated = params => statusMessage({
  label: 'updated', level: 'log', bgColor: 'green', color: 'white', ...params
});
const error = params => statusMessage({
  label: 'error', level: 'error', bgColor: 'red', color: 'white', ...params
});
const completed = params => statusMessage({
  label: 'completed', level: 'info', bgColor: 'blue', color: 'white', ...params
});
const unsubscribed = params => statusMessage({
  label: 'unsubscribed', level: 'info', bgColor: 'yellow', color: 'black', ...params
});

export const debug: <T>(id) => ReturnType<tap<T>> = id => isDevMode() ?
  (source: T): Observable<T> => {
    init({id})(source);
    // Makes all debugged observables hot - very useful for debugging
    // source.subscribe(
    //   updated(id, 'forced hot updated'),
    //   // tslint:disable-next-line:no-shadowed-variable
    //   error(id, 'forced hot error'),
    //   completed(id, 'forced hot completed'),
    // );
    return source.pipe(
      tap(
        updated({id}),
        error({id}),
        completed({id}),
      ),
      finalize(unsubscribed({id}))
    ) as Observable<T>;
  } : skipStep;
