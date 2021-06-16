import { formatNumber } from '@angular/common';

export function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

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
      return [...v].slice(0, 3);
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
