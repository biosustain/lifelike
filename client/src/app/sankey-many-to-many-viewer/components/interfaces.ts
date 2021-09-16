import { SankeyAdvancedOptions, SankeyLink } from '../../sankey-viewer/components/interfaces';

export interface SankeyManyToManyAdvancedOptions extends SankeyAdvancedOptions {
  highlightCircular: boolean;
}

export interface SankeyManyToManyLink extends SankeyLink {
  _graphRelativePosition: 'left' | 'right' | 'multiple';
  _visited: string | number;
}
