import { isDevMode } from '@angular/core';

import { Selection } from 'd3-selection';

import { bind } from './decorators';
import { getColectiveBBox } from './svg';

/**
 * Decorator for intercooperation of Typescript classes and D3 callbacks.
 * In principle it just binds `this` to the class instance. Left here renamed for clarity when used with D3.
 */
export const d3Callback = bind;

/**
 * Decorator for intercooperation of Typescript classes and D3 events callbacks.
 * The later ones are called with `this` pointing out to DOM elements.
 * This decorator preserves class instance reference in `this` and maps D3 context/element
 * to the first argument of the decorated method.
 * @param target Class instance
 * @param propertyKey Method name
 * @param descriptor Method descriptor
 */
export function d3EventCallback<T extends object>(target: T, propertyKey: keyof T,
                                                  {value, writable, get, ...descriptor}: PropertyDescriptor): PropertyDescriptor {
  return {
    // we filter out `writable` and `value` since they cannot be defined along `get`
    ...descriptor,
    get() {
      const instance = this as T;
      if (isDevMode()) {
        console.assert(instance, 'bind: instance is undefined');
      }
      return function() {
        if (isDevMode()) {
          console.assert(this, 'd3Event does not have target reference');
        }
        return (
          value ?? get.call(instance)
        ).call(instance, this, ...arguments);
      };
    }
  };
}
