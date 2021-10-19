import { SankeyAdvancedOptions, SankeyLink, SankeyNode, SankeyData, SankeyTrace } from 'app/sankey-viewer/components/interfaces';

export interface SankeyManyToManyAdvancedOptions extends SankeyAdvancedOptions {
  highlightCircular: boolean;
}

export interface SankeyManyToManyLink extends SankeyLink {
  _graphRelativePosition: 'left' | 'right' | 'multiple';
  _visited: string | number;
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

export type SankeyManyToManySelection = {
  node: SankeyManyToManyNode
} | {
  link: SankeyManyToManyLink
} | {
  trace: SankeyTrace
};
