import { Injectable } from '@angular/core';

import { Observable, ReplaySubject, combineLatest, Subject, of, iif } from 'rxjs';
import { pick, isEqual, has, isArray, merge, omitBy, isNil, partial } from 'lodash-es';
import { switchMap, map, filter, shareReplay, distinctUntilChanged, first, tap } from 'rxjs/operators';

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

@Injectable()
export class StateControlAbstractService<Options extends object, State extends object> implements AbstractInjectable {
  default$: Observable<State>;
  delta$: Subject<Partial<State>> = new ReplaySubject<Partial<State>>(1);
  state$: Observable<State>;
  options$: Observable<Options>;

  onInit() {
    this.state$ = combineLatest([
      this.default$,
      this.delta$
    ]).pipe(
      distinctUntilChanged(isEqual),
      map(states => merge({}, ...states)),
      shareReplay(1)
    );
  }


  /**
   * Pick property from property value from state object
   */
  stateAccessor<R>(property) {
    return unifiedAccessor(this.state$, property).pipe(
      map(state => state[property]),
      shareReplay(1)
    ) as Observable<R>;
  }

  /**
   * Resolve option value from state
   * @param mapping - defines how to combine option value with coresponding state
   */
  optionStateAccessor<R>(optionProperty, stateProperty, mapping?) {
    mapping = mapping ?? ((option, statePropertyValue) => option[statePropertyValue]);
    return this.optionStateMultiAccessor(
      optionProperty,
      stateProperty,
      mapping ?
        (options, state) => mapping(options[optionProperty], state[stateProperty]) :
        (options, state) => options[optionProperty][state[stateProperty]]
    ) as Observable<R>;
  }

  /**
   * Resolve multiple options with multiple state properties
   * Good example is $linkValueAccessor where state.linkValueAccessorId
   * is resolved either by linkValueAccessors or linkValueGenerators
   * @param mapping - defines how to combine options values with coresponding states
   */
  optionStateMultiAccessor<R>(optionProperties: Many<keyof Options>, stateProperties, mapping?) {
    mapping = mapping ?? ((options, state) => ({options, state}));
    return unifiedAccessor(this.options$, optionProperties).pipe(
      switchMap(options => unifiedAccessor(this.state$, stateProperties).pipe(
        map(state => mapping(options, state)),
        shareReplay(1)
      ))
    ) as Observable<R>;
  }

  patchState(
    statePatch: Partial<State>,
    reducer: (stateDelta: Partial<State>, patch: Partial<State>) => Partial<State> = partial(merge, {})
  ): Observable<Partial<State>> {
    return this.delta$.pipe(
      first(),
      switchMap(currentStateDelta => {
        const newStateDelta = reducer(currentStateDelta, statePatch);
        return iif(
          () => !isNil(newStateDelta),
          of(
            // ommit empty values so they can be overridden by defaultState
            omitBy(
              newStateDelta,
              isNil
            ) as Partial<State>
          ),
        );
      }),
      tap(stateDelta => this.delta$.next(stateDelta))
    );
  }
}
