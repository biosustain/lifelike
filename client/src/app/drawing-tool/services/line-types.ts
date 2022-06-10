import { LineTypes } from 'app/graph-viewer/utils/canvas/shared';

export interface LineType {
  name: string;
  descriptor: string;
}

export const LINE_TYPES: Map<string, LineType> = new Map([
  [LineTypes.Blank, {name: 'Blank', descriptor: LineTypes.Blank}],
  [LineTypes.Solid, {name: 'Solid', descriptor: LineTypes.Solid}],
  [LineTypes.Dashed, {name: 'Dashed', descriptor: LineTypes.Dashed}],
  [LineTypes.LongDashed, {name: 'Long Dashed', descriptor: LineTypes.LongDashed}],
  [LineTypes.Dotted, {name: 'Dotted', descriptor: LineTypes.Dotted}],
  [LineTypes.TwoDash, {name: 'Two-Dash', descriptor: LineTypes.TwoDash}],
]);
