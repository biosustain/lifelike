export interface Property {
  description: string;
}

export interface FunctionProperty extends Property {
  name: string;
  fn: (...args: any[]) => any;
}

export type PropertyDictionary<Id extends string | number | symbol, P extends Property> = {
  [id in Id]: P;
};
