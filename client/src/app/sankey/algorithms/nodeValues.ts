import { sum } from 'd3-array';


import { representativePositiveNumber } from '../utils';
import { DefaultLayoutService } from '../services/layout.service';
import { ValueProcessingStep } from '../interfaces/valueAccessors';
import { TypeContext } from '../interfaces';

export const fixedValue: (value: number) => ValueProcessingStep<TypeContext> =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function, so we can maintain execution context
    function(this: DefaultLayoutService, {nodes}) {
      nodes.forEach(n => {
        n.value = value;
      });
      return {
        _sets: {
          node: {
            value: true
          }
        }
      };
    };

export function noneNodeValue(this: DefaultLayoutService, {nodes}) {
  const {sourceValue, targetValue} = this;
  nodes.forEach(n => {
    n.value = Math.max(sum(n.sourceLinks, sourceValue), sum(n.targetLinks, targetValue));
  });
  return {
    _sets: {
      node: {
        value: false
      }
    }
  };
}

export const byProperty: (property: string) => ValueProcessingStep<TypeContext> =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {nodes}) {
      nodes.forEach(n => {
        n.value = representativePositiveNumber(n[property]);
      });
      return {
        _sets: {
          node: {
            value: true
          }
        }
      };
    };
