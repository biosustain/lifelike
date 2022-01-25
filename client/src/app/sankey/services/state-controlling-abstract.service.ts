import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { pick, isEqual, has, isArray } from 'lodash-es';
import { switchMap, map, filter, shareReplay, distinctUntilChanged, tap } from 'rxjs/operators';

import { Many } from 'app/shared/schemas/common';

@Injectable()
export class StateControlAbstractService<Options extends object = object, State extends object = object> {
  state$: Observable<State>;
  options$: Observable<Options>;

  /**
   * Pick property from observable object
   * @param observable object
   * @param prop property name (can be also list of properties)
   */
  unifiedAccessor<R>(observable, prop) {
    const hasOwnProp = isArray(prop) ?
      obj => prop.every(p => has(obj, p)) :
      obj => has(obj, prop);
    return observable.pipe(
      filter(hasOwnProp),
      map(obj => pick(obj, prop)),
      distinctUntilChanged(isEqual),
    ) as Observable<R>;
  }

  /**
   * Pick property from property value from state object
   */
  stateAccessor<R>(property) {
    return this.unifiedAccessor(this.state$, property).pipe(
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
    return this.unifiedAccessor(this.options$, optionProperties).pipe(
      switchMap(options => this.unifiedAccessor(this.state$, stateProperties).pipe(
        map(state => mapping(options, state)),
        shareReplay(1)
      ))
    ) as Observable<R>;
  }
}
