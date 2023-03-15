import { Pipe, PipeTransform } from '@angular/core';

import { Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

@Pipe({
  name: 'addStatus',
})
export class AddStatusPipe implements PipeTransform {
  transform<T>(observable: Observable<T>): Observable<PipeStatus<T>> {
    return observable.pipe(
      map((value: any) => ({loading: false, value})),
      startWith({loading: true}),
      catchError(error => of({loading: false, error})),
    );
  }
}

export interface PipeStatus<T> {
  loading: boolean;
  value?: T;
  error?: any;
}

export const addStatus = <T>(loadingMock: T) =>
  (observable: Observable<T>): Observable<PipeStatus<T>> =>
  observable.pipe(
    map(results => ({loading: false, value: results})),
    catchError(error => of({loading: false, error})),
    startWith({loading: true, value: loadingMock}),
  );
