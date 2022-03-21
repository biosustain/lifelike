import { sum } from 'd3-array';


import { representativePositiveNumber } from '../utils';
import { DefaultLayoutService } from '../services/layout.service';
import { ValueProcessingStep } from '../interfaces/valueAccessors';

export const fixedValue: (value: number) => ValueProcessingStep =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function, so we can maintain execution context
    function(this: DefaultLayoutService, {nodes}) {
      nodes.forEach(n => {
        n._value = value;
      });
      return {
        _sets: {
          node: {
            _value: true
          }
        }
      };
    };

export function noneNodeValue(this: DefaultLayoutService, {nodes}) {
  const {sourceValue, targetValue} = this;
  nodes.forEach(n => {
    n._value = Math.max(sum(n._sourceLinks, sourceValue), sum(n._targetLinks, targetValue));
  });
  return {
    _sets: {
      node: {
        _value: false
      }
    }
  };
}

export const byProperty: (property: string) => ValueProcessingStep =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {nodes}) {
      nodes.forEach(n => {
        n._value = representativePositiveNumber(n[property]);
      });
      return {
        _sets: {
          node: {
            _value: true
          }
        }
      };
    };
