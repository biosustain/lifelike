/**
 * Decorator chnging class method to getter with binded this
 * @param target Class instance
 * @param propertyKey Method name
 * @param descriptor Method descriptor
 */
import { isDevMode } from '@angular/core';

export function bind<T extends object>(target: T, propertyKey: keyof T, {value, get, writable, ...descriptor}: PropertyDescriptor): PropertyDescriptor {
  return {
    ...descriptor,
    get: function() {
      const instance = this as T;
      isDevMode() && console.assert(instance, 'bind: instance is undefined');
      return function() {
        isDevMode() && this === instance && console.warn(`This equals bind - potentially missused decorator for ${target.constructor.name}.${propertyKey}.`);
        return (
          value ?? get.call(instance)
        ).call(instance, ...arguments);
      }
    }
  };
}
