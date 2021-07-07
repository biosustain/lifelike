import { Prescaler, ArrayWithDefault } from '../interfaces';

const prescalers: ArrayWithDefault<Prescaler> = [
  {
    name: 'None',
    description: 'No transformation',
    fn: (v: number) => v
  },
  {
    name: 'ln',
    description: 'Natural logarithm',
    fn: Math.log
  },
  {
    name: 'log2',
    description: 'Base-2 logarithm',
    fn: v => Math.log2(v + 1)
  },
  {
    name: 'log10',
    description: 'Base-10 logarithm',
    fn: v => Math.log10(v + 1)
  },
  {
    name: 'sqrt',
    description: 'Square ***ARANGO_USERNAME***',
    fn: Math.sqrt
  },
  {
    name: 'cbrt',
    description: 'Cube ***ARANGO_USERNAME***',
    fn: Math.cbrt
  },
  {
    name: '1/x',
    description: 'Value multiplicative inverse',
    fn: v => 1 / v
  },
  {
    name: 'arctan',
    description: 'Arctangent',
    fn: Math.atan
  }
];

prescalers.default = prescalers[0];

export default prescalers;


