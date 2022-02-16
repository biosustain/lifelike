import { Observable } from 'rxjs';
import { filter, map, distinctUntilChanged } from 'rxjs/operators';
import { has, isArray, pick, isEqual } from 'lodash-es';

import { Many } from 'app/shared/schemas/common';

export interface AbstractInjectable {
  onInit: () => void;
}

/**
 * Pick property from observable object
 * @param observable object
 * @param prop property name (can be also list of properties)
 */
export const unifiedAccessor = <R extends object, K extends Many<keyof R>>(observable: Observable<R>, prop: K) => {
  const hasOwnProp = isArray(prop) ?
    obj => prop.every(p => has(obj, p)) :
    obj => has(obj, prop);
  return observable.pipe(
    filter(hasOwnProp),
    map(obj => pick(obj, prop)),
    distinctUntilChanged(isEqual),
  );
};

/**
 * Pick property from observable object
 * @param observable object
 * @param prop property name (can be also list of properties)
 */
export function unifiedSingularAccessor<R extends object, K extends keyof R>(observable: Observable<R>, prop: K) {
  return observable.pipe(
    filter(obj => has(obj, prop)),
    map(obj => obj[prop]),
    distinctUntilChanged(),
  ) as Observable<R[K]>;
}
