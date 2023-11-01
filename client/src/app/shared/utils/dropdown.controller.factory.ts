import { isEmpty } from 'lodash/fp';
import { BehaviorSubject, EMPTY, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface DropdownController<T> {
  entities: ReadonlyArray<T>;
  readonly currentIdx$?: Observable<number>;
  readonly current$: Observable<T | null>;
  select(entity?: T): void;
}

export const dropdownControllerFactory = <T>(
  entities: T[],
  initialValue?: T
): DropdownController<T> => {
  entities = entities ?? [];
  const current$ = new BehaviorSubject(initialValue);
  return {
    entities,
    current$,
    select(entity: T) {
      current$.next(entity);
    },
  };
};
