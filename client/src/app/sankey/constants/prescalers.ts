import { PRESCALERS, PRESCALER_ID } from '../interfaces/prescalers';

export const prescalers: PRESCALERS = Object.freeze({
  [PRESCALER_ID.none]: {
    name: PRESCALER_ID.none,
    description: 'No transformation',
    fn: (v: number) => v
  },
  [PRESCALER_ID.ln]: {
    name: PRESCALER_ID.ln,
    description: 'Natural logarithm',
    fn: Math.log
  },
  [PRESCALER_ID.log2]: {
    name: PRESCALER_ID.log2,
    description: 'Base-2 logarithm',
    fn: v => Math.log2(v + 1)
  },
  [PRESCALER_ID.log10]: {
    name: PRESCALER_ID.log10,
    description: 'Base-10 logarithm',
    fn: v => Math.log10(v + 1)
  },
  [PRESCALER_ID.sqrt]: {
    name: PRESCALER_ID.sqrt,
    description: 'Square ***ARANGO_USERNAME***',
    fn: Math.sqrt
  },
  [PRESCALER_ID.cbrt]: {
    name: PRESCALER_ID.cbrt,
    description: 'Cube ***ARANGO_USERNAME***',
    fn: Math.cbrt
  },
  [PRESCALER_ID.one_by_x]: {
    name: PRESCALER_ID.one_by_x,
    description: 'Value multiplicative inverse',
    fn: v => 1 / v
  },
  [PRESCALER_ID.arctan]: {
    name: PRESCALER_ID.arctan,
    description: 'Arctangent',
    fn: Math.atan
  }
});
