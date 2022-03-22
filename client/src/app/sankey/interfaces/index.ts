import { GraphTraceNetwork, GraphGraph, GraphFile, GraphNode, GraphLink } from 'app/shared/providers/graph-type/interfaces';

import { SankeyTrace, SankeyNode, SankeyLink, SankeyId } from './pure';
import { PRESCALERS } from './prescalers';
import { ALIGN_ID, ALIGNS } from './align';
import {
  NODE_VALUE_GENERATORS,
  LINK_VALUE_GENERATORS,
  PREDEFINED_VALUE_ACCESSORS,
  LinkValueAccessor,
  NodeValueAccessor
} from './valueAccessors';
import { SankeyViews } from './view';

// Re-export the interfaces which are defined separately for DOMless ussage
export * from './pure';

export interface IntermediateProcessedData extends Partial<SankeyData> {
  _sets: object;
}

export interface SankeyStaticOptions {
  aligns: ALIGNS;
  prescalers: PRESCALERS;
  nodeValueGenerators: NODE_VALUE_GENERATORS;
  linkValueGenerators: LINK_VALUE_GENERATORS;
}

export interface SankeyFileOptions {
  networkTraces: Array<SankeyTraceNetwork>;
  nodeValueAccessors: NodeValueAccessor;
  linkValueAccessors: LinkValueAccessor;
  predefinedValueAccessors: PREDEFINED_VALUE_ACCESSORS;
}

export type SankeyOptions = SankeyStaticOptions & Partial<SankeyFileOptions>;

export interface SankeyState {
  networkTraceIdx?: number;
  prescalerId?: string;
  normalizeLinks?: boolean;
  labelEllipsis?: {
    enabled: boolean,
    value: number
  } | undefined;
  fontSizeScale?: number;
  viewName?: string;
  baseViewName?: ViewBase;
  alignId?: ALIGN_ID;
}

export interface SankeyTraceNetwork extends GraphTraceNetwork {
  traces: Array<SankeyTrace>;
}

export interface SankeyGraph extends GraphGraph {
  trace_networks: Array<SankeyTraceNetwork>;
}

export interface SankeyFile<
  Graph extends GraphGraph = SankeyGraph,
  Node extends GraphNode = SankeyNode,
  Link extends GraphLink = SankeyLink
> extends GraphFile {
  graph: Graph;
  links: Array<Link>;
  nodes: Array<Node>;

  _views: SankeyViews;
}

export interface SankeyData extends SankeyFile {
  graph: SankeyGraph;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;
}

// Do not change these strings! They are tightly coupled with urls.
export enum ViewBase {
  sankeyMultiLane = 'sankey',
  sankeySingleLane = 'sankey-many-to-many'
}

export interface NetworkTraceData<Node extends SankeyNode = SankeyNode, Link extends SankeyLink = SankeyLink> {
  nodes: Array<Node>;
  links: Array<Link>;
  sources: SankeyId[];
  targets: SankeyId[];
}

