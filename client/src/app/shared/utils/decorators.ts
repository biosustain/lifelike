/**
 * Decorator chnging class method to getter with binded this
 * @param target Class instance
 * @param propertyKey Method name
 * @param descriptor Method descriptor
 */
import { isDevMode } from '@angular/core';

import { isBoolean } from 'lodash-es';

export function bind<T extends object>(target: T, propertyKey: keyof T,
                                       {value, get, writable, ...descriptor}: PropertyDescriptor): PropertyDescriptor {
  return {
    ...descriptor,
    get() {
      const instance = this as T;
      if (isDevMode()) {
        console.assert(instance, 'bind: instance is undefined');
      }
      return function() {
        if (isDevMode() && this === instance) {
          console.warn(`This equals bind - potentially missused decorator for ${target.constructor.name}.${propertyKey}.`);
        }
        return (
          value ?? get.call(instance)
        ).call(instance, ...arguments);
      };
    }
  };
}

/**
 * Make class property enumerable
 *
 * Example usage:
 * ```
 *   @enumerable - make property enumerable
 *   @enumerable() - make property enumerable
 *   @enumerable(true) - make property enumerable
 *   @enumerable(false) - make property not enumerable
 * ```
 */
export function enumerable(valueOrTarget: any, propertyKey: string, descriptor: PropertyDescriptor);
export function enumerable(valueOrTarget: boolean = true, propertyKey?: string, descriptor?: PropertyDescriptor) {
  if (isBoolean(valueOrTarget)) {
    return (_target: any, _propertyKey: string, _descriptor: PropertyDescriptor) => {
      _descriptor.enumerable = valueOrTarget;
    };
  }
  descriptor.enumerable = true;
}
