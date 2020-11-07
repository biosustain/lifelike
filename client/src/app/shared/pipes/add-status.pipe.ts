import { Pipe, PipeTransform } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

@Pipe({
  name: 'addStatus',
})
export class AddStatusPipe implements PipeTransform {
  transform<T>(observable: Observable<T>): Observable<{
    loading: boolean,
    value?: T,
    error?: any
  }> {
    return observable.pipe(
        map((value: any) => ({loading: false, value})),
        startWith({loading: true}),
        catchError(error => of({loading: false, error})),
    );
  }
}
