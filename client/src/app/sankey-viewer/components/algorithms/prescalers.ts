import { ArrayWithDefault, Prescaler } from './interfaces';

const prescalers: ArrayWithDefault<Prescaler> = [
  {
    name: 'None',
    description: 'No transformation',
    fn: (v: number) => v
  } as Prescaler,
  {
    name: 'ln',
    description: 'Natural logarithm',
    fn: Math.log
  } as Prescaler,
  {
    name: 'ln(x + 1)',
    description: 'Natural logarithm moved by one',
    fn: v => Math.log1p(v)
  },
  {
    name: 'log2(x + 1)',
    description: 'Base-2 logarithm moved by one',
    fn: v => Math.log2(v + 1)
  },
  {
    name: 'log10(x + 1)',
    description: 'Base-10 logarithm moved by one',
    fn: v => Math.log10(v + 1)
  },
  {
    name: 'sqrt',
    description: 'square ***ARANGO_USERNAME***',
    fn: Math.sqrt
  },
  {
    name: '1/x',
    description: 'Value multiplicative inverse',
    fn: v => 1 / v
  } as Prescaler
];

prescalers.default = prescalers[0];

export default prescalers;


