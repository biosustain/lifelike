import { isNotEmpty } from 'app/shared/utils';

import { representativePositiveNumber } from '../utils';
import { DefaultLayoutService } from '../services/layout.service';
import { ValueProcessingStep } from '../interfaces/valueAccessors';
import { NetworkTraceData, TypeContext } from '../interfaces';
import { SankeyLink } from '../model/sankey-document';

export const fixedValue: (value: number) => ValueProcessingStep<TypeContext> =
  value =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l.value = value;
        delete l.multipleValues;
      });
      return {
        links,
        _sets: {
          link: {
            value: true
          }
        }
      };
    };


export const byProperty: (property: string) => ValueProcessingStep<TypeContext> =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        l.value = representativePositiveNumber((l as SankeyLink).get(property));
        delete l.multipleValues;
      });
      return {
        _sets: {
          link: {
            value: true,
            multipleValues: false
          }
        },
        _requires: {
          link: {
            _adjacent_normalisation: true
          }
        }
      };
    };


export const byArrayProperty: (property: string) => ValueProcessingStep<TypeContext> =
  property =>
    // tslint:disable-next-line:only-arrow-functions // allowing non-arrow function so we can maintain execution context
    function(this: DefaultLayoutService, {links}) {
      links.forEach(l => {
        const [v1, v2] = (l as SankeyLink).get(property);
        l.multipleValues = [v1, v2].map(d => representativePositiveNumber(d)) as [number, number];
        // take max for layer calculation
        l.value = Math.max(...l.multipleValues);
      });
      return {
        _sets: {
          link: {
            multipleValues: true,
            value: true
          }
        },
        _requires: {
          link: {
            _adjacent_normalisation: true
          }
        }
      };
    };
