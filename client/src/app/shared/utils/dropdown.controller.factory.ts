import { isEmpty } from 'lodash/fp';
import { BehaviorSubject, EMPTY, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface DropdownController<T> {
  entities: ReadonlyArray<T>;
  currentIdx$?: BehaviorSubject<number>;
  current$: Observable<T>;
}

export const dropdownControllerFactory = <T>(entities: T[]): DropdownController<T> => {
  entities = entities ?? [];
  const currentIdx$ = new BehaviorSubject(-1);
  return {
    entities,
    currentIdx$,
    current$: currentIdx$.pipe(map((idx) => entities[idx])),
  };
};
