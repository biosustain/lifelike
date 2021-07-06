export interface ArrayWithDefault<T> extends Array<T> {
  default?: T;
}

export interface Prescaler {
  name: string;
  description: string;
  fn: (v: number) => number;
}
