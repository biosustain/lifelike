import { HttpErrorResponse } from '@angular/common/http';

import { BehaviorSubject, EMPTY, Observable, ReplaySubject } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { isNull } from 'lodash-es';

import { RequestWrapping } from './interfaces';

export function toRequest<Arguments extends Array<any>, Result extends object>(
  request: (...args: Arguments) => Observable<Result>
) {
  return (arguments$: Observable<Arguments>) =>
    arguments$.pipe(
      map((arg) => {
        const loading$ = new BehaviorSubject(true);
        const error$ = new ReplaySubject<HttpErrorResponse>(1);
        const result$: Observable<any> = request(...arg).pipe(
          tap(() => loading$.next(false)),
          catchError((error) => {
            error$.next(error);
            return EMPTY;
          }),
          finalize(() => {
            loading$.complete();
            error$.complete();
          }),
          shareReplay({ bufferSize: 1, refCount: true })
        );
        return {
          arguments: arg,
          loading$,
          error$,
          result$,
        } as RequestWrapping<Arguments, Result>;
      })
    );
}

export function omitIfNull(...props) {
  return (object) => {
    const r = {};
    for (const [key, value] of Object.entries(object)) {
      if (props.includes(key) && isNull(value)) {
        continue;
      }
      r[key] = value;
    }
    return r;
  };
}
