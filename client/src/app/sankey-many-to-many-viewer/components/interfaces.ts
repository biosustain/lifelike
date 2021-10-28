import {
  SankeyLink,
  SankeyState,
  SankeyNode,
  SankeyData,
  SankeyTrace,
  SelectionType,
  SelectionEntity,
  SankeyOptions
} from 'app/shared-sankey/interfaces';

export interface SankeyManyToManyState extends SankeyState {
  highlightCircular: boolean;
  colorLinkByType: boolean;
}

export interface SankeyManyToManyOptions extends SankeyOptions {
  colorLinkTypes: { [type: string]: string };
}

export interface SankeyManyToManyLink extends SankeyLink {
  _graphRelativePosition?: 'left' | 'right' | 'multiple';
  _visited?: string | number;
  _traces?: GraphTrace[];
}

export interface SankeyManyToManyNode extends SankeyNode {
  _source: SankeyManyToManyLink;
  _target: SankeyManyToManyLink;
}

export interface SankeyManyToManyData extends SankeyData {
  links: SankeyManyToManyLink[];
  nodes: SankeyManyToManyNode[];
}


// region Selection
export type SelectionManyToManyEntity = SelectionEntity | {
  [SelectionType.link]: SankeyManyToManyLink;
};
// endregion

export type SankeyManyToManySelection = {
  node: SankeyManyToManyNode
} | {
  link: SankeyManyToManyLink
} | {
  trace: SankeyTrace
};
