export interface LineType {
  name: string;
  descriptor: string;
}

export const LINE_TYPES: Map<string, LineType> = new Map([
  ['none', {name: 'None', descriptor: 'none'}],
  ['solid', {name: 'Solid', descriptor: 'solid'}],
  ['dashed', {name: 'Dashed', descriptor: 'dashed'}],
]);
