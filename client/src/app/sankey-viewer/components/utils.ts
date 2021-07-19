import { formatNumber } from '@angular/common';
import { cubehelix } from 'd3';

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

// region Colors
export const christianColors = [
  '#1CE6FF', '#FF34FF', '#FF4A46', '#008941', '#006FA6', '#A30059', '#FFFF00',
  '#FFDBE5', '#7A4900', '#0000A6', '#63FFAC', '#B79762', '#004D43', '#8FB0FF', '#997D87',
  '#5A0007', '#809693', '#FEFFE6', '#1B4400', '#4FC601', '#3B5DFF', '#4A3B53', '#FF2F80',
  '#61615A', '#BA0900', '#6B7900', '#00C2A0', '#FFAA92', '#FF90C9', '#B903AA', '#D16100',
  '#DDEFFF', '#000035', '#7B4F4B', '#A1C299', '#300018', '#0AA6D8', '#013349', '#00846F',
  '#372101', '#FFB500', '#C2FFED', '#A079BF', '#CC0744', '#C0B9B2', '#C2FF99', '#001E09',
  '#00489C', '#6F0062', '#0CBD66', '#EEC3FF', '#456D75', '#B77B68', '#7A87A1', '#788D66',
  '#885578', '#FAD09F', '#FF8A9A', '#D157A0', '#BEC459', '#456648', '#0086ED', '#886F4C',
  '#34362D', '#B4A8BD', '#00A6AA', '#452C2C', '#636375', '#A3C8C9', '#FF913F', '#938A81',
  '#575329', '#00FECF', '#B05B6F', '#8CD0FF', '#3B9700', '#04F757', '#C8A1A1', '#1E6E00',
  '#7900D7', '#A77500', '#6367A9', '#A05837', '#6B002C', '#772600', '#D790FF', '#9B9700',
  '#549E79', '#FFF69F', '#201625', '#72418F', '#BC23FF', '#99ADC0', '#3A2465', '#922329',
  '#5B4534', '#FDE8DC', '#404E55', '#0089A3', '#CB7E98', '#A4E804', '#324E72', '#6A3A4C',
  '#83AB58', '#001C1E', '#D1F7CE', '#004B28', '#C8D0F6', '#A3A489', '#806C66', '#222800',
  '#BF5650', '#E83000', '#66796D', '#DA007C', '#FF1A59', '#8ADBB4', '#1E0200', '#5B4E51',
  '#C895C5', '#320033', '#FF6832', '#66E1D3', '#CFCDAC', '#D0AC94', '#7ED379', '#012C58'];

export const colorPalletGenerator = (
  size,
  {
    hue = (i, n) => i / n,
    saturation = (_i, _n) => 0.75,
    lightness = (_i, _n) => 0.75,
    alpha = (_i, _n) => 0.75
  } = {}
) => {
  return i => cubehelix(
    360 * hue(i, size),
    2 * saturation(i, size),
    lightness(i, size),
    alpha(i, size)
  );
};

export const createMapToColor = (arr, ...rest) => {
  const uniq = arr instanceof Set ? arr : new Set(arr);
  const palette = colorPalletGenerator(uniq.size, ...rest);
  return new Map([...uniq].map((v, i) => [v, palette(i)]));
};
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
      const vAsArray = [...v];
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
