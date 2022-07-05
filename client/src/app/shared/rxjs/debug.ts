// @ts-nocheck
import { isDevMode } from '@angular/core';

import { tap, finalize } from 'rxjs/operators';
import { isInteger, isString } from 'lodash-es';

import { skipStep } from './skipStep';

interface FormatedValue {
  format: string;
  value: any[];
}

const composeLabelFormatMapping = (label, bgColor, color) => ({
  format: '%c%s%c',
  value: [
    `background-color: ${bgColor}; color: ${color}; padding: 2px 4px;`,
    label.toUpperCase(),
    `background-color: initial;`
  ]
});


const mapEntityToFormat = entity => {
  if (entity instanceof Node) {
    return '%o';
  }
  if (isInteger(entity)) {
    return '%i';
  }
  if (isString(entity)) {
    return '%s';
  }
  return '%O';
};

const composeTitleFormatMapping = params => ({
  format: ` %c${params.map(mapEntityToFormat).join('')}%c`,
  value: [
    `font-weight: bold;`,
    ...params,
    `font-weight: initial;`
  ]
});

const combineFormatedValues = (...formatedValues: FormatedValue[]) => formatedValues.reduce(
  (r, formatedValue) => ({
    format: r.format + formatedValue.format,
    value: r.value.concat(formatedValue.value)
  }),
  {format: '', value: []} as FormatedValue
);

const composeFormatMapping = ({args, label, params = [''], bgColor, color}) => {
  const formatedValue = combineFormatedValues(
    composeLabelFormatMapping(label, bgColor, color),
    composeTitleFormatMapping(params)
  );
  return [formatedValue.format, ...formatedValue.value, ...args];
};

const statusMessage = ({level, ...rest}) => (...args) => console[level](
  ...composeFormatMapping({args, ...rest})
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

/**
 * console interface mapping for rxjs - console as operator
 * This utility displays given params along with formated status of observable
 * upon each change. Common ussage would be:
 * ```
 *   of("abc").pipe(debug("ABC"))
 *   Outputs:
 *     (level debug) INIT ABC: ObservableRef
 *   .suscribe()
 *   Outputs:
 *     (level log) UPDATED ABC: "abc"
 *     (level info) COMPLETED ABC
 *   .unsuscribe()
 *   Outputs:
 *     (level info) UNSUSCRIBED ABC
 * @param params set of params as we would use for console.log
 */
export const debug: <T>(message?: any, ...optionalParams: any[]) => MonoTypeOperatorFunction<T> = (...params) => isDevMode() ?
  (source: Observable<T>): Observable<T> => {
    init({params})(source);
    // Makes all debugged observables hot - very useful for debugging
    // source.subscribe(
    //   updated(id, 'forced hot updated'),
    //   // tslint:disable-next-line:no-shadowed-variable
    //   error(id, 'forced hot error'),
    //   completed(id, 'forced hot completed'),
    // );
    return source.pipe(
      tap(
        updated({params}),
        error({params}),
        completed({params}),
      ),
      finalize(unsubscribed({params}))
    );
  } : skipStep as MonoTypeOperatorFunction<T>;
