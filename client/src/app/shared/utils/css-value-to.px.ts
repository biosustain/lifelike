import { isNil as _isNil } from 'lodash/fp';

export const cssValueToPx = (cssValue: number | string, parentSize?: number) => {
  if (typeof cssValue === 'string') {
    if (cssValue.endsWith('%')) {
      if (_isNil(parentSize)) {
        throw new Error(`Parent container size is required for percentage value ${cssValue}`);
      }
      return (parentSize * Number(cssValue.slice(0, -1))) / 100;
    } else if (cssValue.endsWith('px')) {
      return Number(cssValue.slice(0, -2));
    } else {
      throw new Error(`Unknown unit ${cssValue}, only px and % are supported`);
    }
  } else {
    return cssValue;
  }
};
