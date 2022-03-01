// @ts-nocheck
import { isDevMode } from '@angular/core';

import { tap } from 'rxjs/operators';

const statusMessage = (level, color, label, id) => (...args) => console[level](
  `%c%s%c %s${args.length ? ':' : ''}%c`,
  `background-color: ${color}; color: white; mix-blend-mode: difference; padding: 2px 4px;`,
  label.toUpperCase(),
  `background-color: initial; font-weight: bold;`,
  id,
  `font-weight: initial;`,
  ...args
);

const init      = (id, label = 'init',      level = 'debug', color = 'deeppink') => statusMessage(level, color, label, id);
const updated   = (id, label = 'updated',   level = 'log',   color = 'green'   ) => statusMessage(level, color, label, id);
const error     = (id, label = 'error',     level = 'error', color = 'red'     ) => statusMessage(level, color, label, id);
const completed = (id, label = 'completed', level = 'info',  color = 'blue'    ) => statusMessage(level, color, label, id);

export const debug = <T>(id) => isDevMode() ?
  (source) => {
    init(id)(source);
    // Makes all debugged observables hot - very useful for debugging
    // source.subscribe(
    //   updated(id, 'forced hot updated'),
    //   // tslint:disable-next-line:no-shadowed-variable
    //   error(id, 'forced hot error'),
    //   completed(id, 'forced hot completed'),
    // );
    return tap<T>(
      updated(id),
      error(id),
      completed(id),
    )(source);
  } :
  tap<T>();
