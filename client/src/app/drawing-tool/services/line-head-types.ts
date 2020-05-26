export interface LineHeadType {
  name: string;
  descriptor: string;
}

export const LINE_HEAD_TYPES: Map<string, LineHeadType> = new Map([
  ['none', {name: 'None', descriptor: 'none'}],
  ['arrow', {name: 'Arrow', descriptor: 'arrow'}],
  ['circle-arrow', {name: 'Circle Arrow', descriptor: 'circle,spacer,arrow'}],
  ['square-arrow', {name: 'Square Arrow', descriptor: 'square,spacer,arrow'}],
  ['cross-axis-arrow', {name: 'Cross-Axis Arrow', descriptor: 'cross-axis,spacer,arrow'}],
  ['cross-axis', {name: 'Cross-Axis', descriptor: 'cross-axis'}],
  ['diamond', {name: 'Diamond', descriptor: 'diamond'}],
  ['square', {name: 'Square', descriptor: 'square'}],
  ['circle', {name: 'Circle', descriptor: 'circle'}],
  ['double-cross-axis', {name: 'Double Cross-Axis', descriptor: 'cross-axis,cross-axis'}],
]);
