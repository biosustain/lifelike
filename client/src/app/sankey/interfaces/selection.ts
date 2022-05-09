import { SankeyLink, SankeyNode, Trace } from '../cls/SankeyDocument';

// region Selection
export enum SelectionType {
  // assign values to use in template
  link = 'link',
  node = 'node',
  trace = 'trace'
}

export type SelectionEntity = {
  type: SelectionType.link,
  entity: SankeyLink;
} | {
  type: SelectionType.node,
  entity: SankeyNode;
} | {
  type: SelectionType.trace,
  entity: Trace;
};
