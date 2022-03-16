import { Observable } from 'rxjs';
import { filter, map, distinctUntilChanged, startWith, pairwise, scan, switchMap } from 'rxjs/operators';
import { has, isArray, pick, isEqual, isEmpty, uniq } from 'lodash-es';
import { Selection as d3_Selection } from 'd3-selection';

import { Many } from 'app/shared/schemas/common';
import { isNotEmpty } from 'app/shared/utils';

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

interface UpdateCycle<Selection extends d3_Selection<any, any, any, any> = d3_Selection<any, any, any, any>> {
  otherOnStart: (selection: Selection) => void;
  enter: (selection: Selection) => void;
  exit: (selection: Selection) => void;
  affectedOnEnd: (selection: Selection) => void;
}

/**
 * Helps with making incremental update to given selection.
 * Change from empty to non-empty value is considered as cycle 'start'.
 * Change from non-empty to empty value is considered as cycle 'end'.
 * On end of cycle, affected selection is cleared.
 * On flow level this operator behaves like 'distinctUntilChanged(isEqual)' operator.
 * Example:
 *
 * const updateLog = update([1, 2, 3, 4], {
 *   otherOnStart: s => console.log('otherOnStart', s),
 *   enter: s => console.log('enter', s),
 *   exit: s => console.log('exit', s),
 *   affectedOnEnd: s => console.log('affectedOnEnd', s)
 *  });
 * of([1, 2, 3], [2, 3, 4], [2, 3, 4], [], [1]).pipe(
 *  updateLog
 * ).subscribe(console.log);
 * ```
 * otherOnStart [4]
 * enter [1, 2, 3]
 * [1, 2, 3]
 * exit [1]
 * enter [4]
 * [2, 3, 4]
 * affectedOnEnd [1, 2, 3, 4]
 * []
 * otherOnStart [2, 3, 4]
 * enter [1]
 * [1]
 * ```
 * There is also no update on initial empty.
 * Example:
 * of([], [1, 2], [1, 2], [1]).pipe(
 *  updateLog
 * ).subscribe(console.log);
 * ```
 * otherOnStart [2]
 * enter [1]
 * [1, 2]
 * exit [2]
 * [1]
 * ```
 *
 * @param selection Array of d3 Selection
 * @param otherOnStart callback on elements that are not in initial selection
 * @param enter callback on elements that are added
 * @param exit callback on elements that are removed
 * @param affectedOnEnd callback on elements that has been changed when solection is emptied
 * @param accessor (arr, d) => bool check if d is in arr
 */
export const update =
  <Selection extends d3_Selection<any, any, any, any> = d3_Selection<any, any, any, any>, T = any>
  (
    selectionObservable: Observable<Selection>,
    {
      otherOnStart,
      enter,
      exit,
      affectedOnEnd,
      accessor = (arr: Array<T>, d: T) => arr?.includes(d)
    }: (Partial<UpdateCycle> & { accessor?: (arr, d) => boolean })
  ) => (project: Observable<T[]>) => project.pipe(
    distinctUntilChanged(isEqual),
    startWith([]),
    pairwise(),
    switchMap(prevNext => selectionObservable.pipe(
      map(selection => prevNext.concat(selection)),
    )),
    scan(([affectedSoFar], [prev, next, selection]) => {
      if (isEmpty(next)) {
        if (otherOnStart) {
          affectedOnEnd?.(selection);
        } else {
          affectedOnEnd?.(selection.filter(d => affectedSoFar.includes(d)));
        }
        return [[], next];
      }
      let enterSelection;
      if (isEmpty(prev)) {
        otherOnStart?.(selection.filter(d => !accessor(next, d)));
        enterSelection = selection.filter(d => accessor(next, d));
      } else {
        if (isNotEmpty(prev)) {
          exit?.(selection.filter(d => accessor(prev, d) && !accessor(next, d)));
        }
        enterSelection = selection.filter(d => accessor(next, d) && !accessor(prev, d));
      }
      enter?.(enterSelection);
      // if we affect all on start or there is no default to come back to (affectedOnEnd),
      // we do not keep track of affected list (it is always all or is not used at the end)
      const affectedSoFarNext = (otherOnStart || !affectedOnEnd) ? [] : uniq(affectedSoFar.concat(enterSelection.data()));
      return [affectedSoFarNext, next];
    }, [[]]),
    map(([, next]) => next)
  );

export const updateSingular =
  <Selection extends d3_Selection<any, any, any, any> = d3_Selection<any, any, any, any>, T = any>
  (
    selectionObservable: Observable<Selection>,
    {
      enter,
      exit,
      // tslint:disable-next-line:triple-equals // null == undefined == 0 -> does not matter in here
      comparator = (a: T, b: T) => a == b
    }: (Partial<UpdateCycle> & { comparator?: (a, b) => boolean })
  ) => (project: Observable<T>) => project.pipe(
    distinctUntilChanged(comparator),
    startWith(),
    pairwise(),
    switchMap(prevNext => selectionObservable.pipe(
      map(selection => prevNext.concat(selection)),
    )),
    map(([prev, next, selection]) => {
      if (prev) {
        exit?.(selection.filter(d => comparator(prev, d)));
      }
      if (next) {
        enter?.(selection.filter(d => comparator(next, d)));
      }
      return next;
    })
  );

/**
 * Updates d3 selection attribute with 3 states (not declared, true, false)
 * - [] -> selection attribute is removed
 * - [...nodes] -> selection attribute is set to true for nodes and false for other (raise nodes)
 * @param selection d3 selection to update
 * @param attr attribute to set based on array of nodes
 * @param overwrites adjustment of method (check update() doc)
 */
export const updateAttr = (selectionObservable, attr, overwrites = {}) => update(
  selectionObservable,
  {
    otherOnStart: s => s.attr(attr, false),
    enter: s => s.attr(attr, true).raise(),
    exit: s => s.attr(attr, false),
    affectedOnEnd: s => s.attr(attr, undefined),
    ...overwrites
  }
);

export const updateAttrSingular = (selectionObservable, attr, overwrites = {}) => updateSingular(selectionObservable, {
  enter: s => s.attr(attr, true).raise(),
  exit: s => s.attr(attr, undefined),
  ...overwrites
});
