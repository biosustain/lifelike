import { PropertyDictionary, FunctionProperty } from './property';

export interface Prescaler extends FunctionProperty {
  fn: (v: number) => number;
}

export enum PRESCALER_ID {
  none = 'None',
  ln = 'ln',
  log2 = 'log2',
  log10 = 'log10',
  sqrt = 'sqrt',
  cbrt = 'cbrt',
  one_by_x = '1/x',
  arctan = 'arctan'
}

export type PRESCALERS = PropertyDictionary<PRESCALER_ID, Prescaler>;
