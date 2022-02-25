import { isDevMode } from '@angular/core';

import { tap } from 'rxjs/operators';
import { partial } from 'lodash-es';

const statusMessage = (level, label, color, id, ...args) => console[level](
  `%c%s%c %s${args.length ? ':' : ''}%c`,
  `background-color: ${color}; color: white; mix-blend-mode: difference; padding: 2px 4px;`,
  label.toUpperCase(),
  `background-color: initial; font-weight: bold;`,
  id,
  `font-weight: initial;`,
  ...args
);

const init = partial(statusMessage, 'debug', 'init', 'deeppink');
const updated = partial(statusMessage, 'log', 'updated', 'green');
const error = partial(statusMessage, 'error', 'error', 'red');
const completed = partial(statusMessage, 'info', 'completed', 'blue');

export const debug = id => isDevMode() ?
  (source) => {
    // @ts-ignore
    init(id, source);
    // Makes all debugged observables hot - very useful for debugging
    // source.subscribe(
    //   (value) => statusMessage('forced hot updated', 'green', id, value),
    //   (error) => statusMessage('forced hot error', 'red', id, error),
    //   () => statusMessage('forced hot completed', 'blue', id),
    // );
    return tap(
      partial(updated, id),
      partial(error, id),
      partial(completed, id),
    )(source);
  } :
  tap();
