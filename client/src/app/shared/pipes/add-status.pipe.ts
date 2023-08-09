import { Pipe, PipeTransform } from '@angular/core';

import { Observable, of } from 'rxjs';
import { catchError, map, startWith, first } from 'rxjs/operators';

import { TaskState } from '../rxjs/background-task';

export interface PipeStatus<T> {
  loading: boolean;
  value?: T;
  error?: any;
}

export const addStatus =
  <T>(loadingMock?: T) =>
  (observable: Observable<T>): Observable<PipeStatus<T>> =>
    observable.pipe(
      map((results) => ({ loading: false, value: results })),
      catchError((error) => of({ loading: false, error })),
      startWith({ loading: true, value: loadingMock })
    );

@Pipe({
  name: 'addStatus',
})
export class AddStatusPipe implements PipeTransform {
  transform = addStatus();
}

export interface MultiPipeStatus<T extends any[]> {
  states: this[];
  loading: boolean;
  values?: T;
  errors?: any[];
}

export const mergeStatuses = <T extends any[]>(statuses: PipeStatus<any>[]) =>
  statuses.reduce(
    (acc, s) => ({
      states: [...acc.states, s],
      loading: acc.loading || s.loading,
      values: s.value ? [...(acc.values || []), s.value] : acc.values,
      errors: s.error ? [...(acc.errors || []), s.error] : acc.errors,
    }),
    {
      states: [],
      loading: false,
    } as MultiPipeStatus<T>
  );
