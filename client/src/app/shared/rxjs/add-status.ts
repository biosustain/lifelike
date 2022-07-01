import { Observable, of } from 'rxjs';
import { map, startWith, catchError } from 'rxjs/operators';

export interface ObservableStatus<T> {
  // probably not the best term - set to true after first update
  loading: boolean;
  value?: T;
  error?: any;
}

const addStatus = <T>(project: Observable<T>) => project.pipe<ObservableStatus<T>, ObservableStatus<T>, ObservableStatus<T>>(
  map((value: any) => ({loading: false, value})),
  startWith({loading: true}),
  catchError(error => of({loading: false, error}))
);
