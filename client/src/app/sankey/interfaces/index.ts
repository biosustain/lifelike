import { GraphTraceNetwork, GraphNode, GraphLink } from 'app/shared/providers/graph-type/interfaces';

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
import { TraceNetwork, SankeyDocument, Trace, SankeyLink, SankeyNode, SankeyTraceLink } from '../cls/SankeyDocument';
import { BaseOptions, BaseState } from '../base-views/multi-lane/interfaces';
import { SankeyLinkInterface, SankeyNodeInterface, SankeyRenderLinkInterface, SankeyRenderNodeInterface } from './pure';
import { SankeyBaseState, SankeyBaseOptions } from '../base-views/interfaces';

// Re-export the interfaces which are defined separately for DOMless ussage
export * from './pure';

export interface IntermediateProcessedData {
  _sets: object;
}

export interface SankeyStaticOptions {
  aligns: ALIGNS;
  prescalers: PRESCALERS;
  nodeValueGenerators: NODE_VALUE_GENERATORS;
  linkValueGenerators: LINK_VALUE_GENERATORS;
}

export interface SankeyFileOptions {
  networkTraces: Array<TraceNetwork>;
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
  _views: SankeyViews;
}

// Do not change these strings! They are tightly coupled with urls.
export enum ViewBase {
  sankeyMultiLane = 'sankey',
  sankeySingleLane = 'sankey-many-to-many'
}

export interface TypeContext {
  options: SankeyBaseOptions;
  state: SankeyBaseState;
  node: SankeyNodeInterface;
  link: SankeyLinkInterface;
  trace: Trace;
  data: NetworkTraceData<this>;
}

export interface NetworkTraceData<Base extends TypeContext> {
  links: Array<Base['link']>;
  nodes: Array<Base['node']>;
  nodeById: Map<string, Base['node']>;
  sources: Array<Base['node']>;
  targets: Array<Base['node']>;
}
