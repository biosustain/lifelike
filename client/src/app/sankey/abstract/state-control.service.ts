import { Observable, ReplaySubject, Subject, of, iif } from 'rxjs';
import { merge, omitBy, isNil, partial } from 'lodash-es';
import { switchMap, map, shareReplay, first, tap } from 'rxjs/operators';

import { Many } from 'app/shared/schemas/common';
import { debug } from 'app/shared/rxjs/debug';

import { unifiedAccessor } from '../utils/rxjs';

export abstract class StateControlAbstractService<Options extends object, State extends object> {
  delta$: Subject<Partial<State>> = new ReplaySubject<Partial<State>>(1);
  state$: Observable<State>;
  options$: Observable<Options>;

  /**
   * Pick property from property value from state object
   */
  stateAccessor<StateProperty extends keyof State>(property: StateProperty) {
    return unifiedAccessor(this.state$, property).pipe(
      map(state => state[property]),
      debug(`stateAccessor(${property})`),
      shareReplay(1)
    ) as Observable<State[StateProperty]>;
  }

  /**
   * Resolve option value from state
   * @param mapping - defines how to combine option value with coresponding state
   */
  optionStateAccessor<MappingResult>(
    optionProperty: keyof Options,
    stateProperty: keyof State,
    mapping?: (option: Options[keyof Options], state: State[keyof State]) => MappingResult
  ) {
    mapping = mapping ?? (
      (option, statePropertyValue) =>
        option[statePropertyValue as any] as MappingResult
    );
    return this.optionStateMultiAccessor(
      optionProperty,
      stateProperty,
      mapping ?
        (options, state) => mapping(options[optionProperty], state[stateProperty]) :
        (options, state) => options[optionProperty][state[stateProperty] as any]
    ) as Observable<MappingResult>;
  }

  /**
   * Resolve multiple options with multiple state properties
   * Good example is $linkValueAccessor where state.linkValueAccessorId
   * is resolved either by linkValueAccessors or linkValueGenerators
   * @param mapping - defines how to combine options values with coresponding states
   */
  optionStateMultiAccessor<MappingResult>(
    optionProperties: Many<keyof Options>,
    stateProperties: Many<keyof State>,
    mapping?: (options: Partial<Options>, state: Partial<State>) => MappingResult
  ) {
    mapping = mapping ?? ((options, state) => ({options, state} as any as MappingResult));
    return unifiedAccessor(this.options$, optionProperties).pipe(
      switchMap(options => unifiedAccessor(this.state$, stateProperties).pipe(
        map(state => mapping(options, state)),
        debug(`optionStateMultiAccessor(${optionProperties}, ${stateProperties})`),
        shareReplay(1)
      ))
    ) as Observable<MappingResult>;
  }

  patchState(
    statePatch: Partial<State>,
    reducer: (stateDelta: Partial<State>, patch: Partial<State>) => Partial<State> = partial(merge, {})
  ): Observable<Partial<State>> {
    return this.delta$.pipe(
      first(),
      map(currentStateDelta => reducer(currentStateDelta, statePatch)),
      // switchMap(currentStateDelta => {
      //   const newStateDelta = reducer(currentStateDelta, statePatch);
      //   return iif(
      //     () => !isNil(newStateDelta),
      //     of(
      //       // ommit empty values so they can be reset to defaultState
      //       omitBy(
      //         newStateDelta,
      //         isNil
      //       ) as Partial<State>
      //     ),
      //   );
      // }),
      tap(stateDelta => this.delta$.next(stateDelta))
    );
  }
}
