import { formatNumber } from '@angular/common';

import { clone, transform } from 'lodash-es';

import { reduceIterable } from 'app/shared/utils';

// region Collections
export function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

export const uniqueBy = (arr, accessor) =>
  arr.reduce((identifiers, elem) => {
    const identifier = accessor(elem);
    if (identifiers.has(identifier)) {
      return identifiers;
    } else {
      identifiers.set(identifier, elem);
      return identifiers;
    }
  }, new Map());
// endregion

// region Numbers
export const isNumber = (v: any) => !isNaN(v) && typeof v !== 'boolean';

export const isPositiveNumber = (v: any) => isNumber(v) || v > 0;

export const clamp = (min, max) => value => Math.min(Math.max(min, Number(value)), max);

export const representativePositiveNumber = clamp(Number.MIN_VALUE, 1e4);
// endregion

export const parseForRendering = (v, propertyName: string | boolean = true) => {
  if (!isNaN(v)) {
    return formatNumber(v, 'en-US', '1.0-6');
  }
  if (typeof v === 'string' || v instanceof String) {
    return v;
  }
  if (typeof v === 'object' && propertyName) {
    if (isIterable(v)) {
      // propertyName === true -- if was not called by JSON parser
      if (propertyName === true) {
        return v.map(n => parseForRendering(n)).join(', ');
      }
      const vAsArray = clone(v);
      if (vAsArray.length > 3) {
        return vAsArray.slice(0, 3).concat(`...${vAsArray.length - 3} hidden elements`);
      } else {
        return vAsArray;
      }
    }
    if (v.id) {
      return `{ id: ${v.id}, ... }`;
    }
    if (v.index) {
      return `{ index: ${v.index}, ... }`;
    }
  }
  return v;
};
export const normalizeGenerator = values => {
  const min = Math.min(...values);
  const max = values.reduce((o, n) => o + n, 0);
  return {
    min, max,
    normalize: (max - min) ? d => Math.max(0, d / max) : d => d / max
  };
};
export const RELAYOUT_DURATION = 250;

export function symmetricDifference(setA, setB, accessor) {
  return reduceIterable(
    uniqueBy(setB, accessor),
    (difference, [identifier, elem]) => {
      if (difference.has(identifier)) {
        difference.delete(identifier);
      } else {
        difference.set(identifier, elem);
      }
      return difference;
    },
    uniqueBy(setA, accessor)
  );
}

/**
 * When searching for item based on property, we can get performance boost by
 * making index by the property first.
 * ***NOTE***:
 * This code assumes that the property is unique.
 * If it is not, then the last match will be returned for given index,
 * @param data - set of objects to index
 * @param property - property to index by
 */
export const indexByProperty = <D extends object>(data: Array<D>, property: keyof D) =>
  transform(data, (acc, n) => acc.set(n[property], n), new Map());

export function extractDescriptionFromSankey(text: string): string {
  try {
    const content = JSON.parse(text);
    return content.graph.description || '';
  } catch (e) {
    return '';
  }
}
