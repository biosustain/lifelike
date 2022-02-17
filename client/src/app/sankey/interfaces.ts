import { PRESCALERS } from 'app/sankey/algorithms/prescalers';
import { GraphTraceNetwork, GraphGraph, GraphLink, GraphNode, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { RecursivePartial } from 'app/shared/schemas/common';

import { DefaultLayoutService } from './services/layout.service';
import { SankeyTrace, SankeyNode, SankeyLink, SankeyId } from './pure_interfaces';

// Re-export the interfaces which are defined separately for DOMless ussage
export * from './pure_interfaces';

// region UI options
export interface ValueAccessor {
  description: string;
  help?: string;
  type?: LINK_PROPERTY_GENERATORS;
}

export interface IntermediateProcessedData extends Partial<SankeyData> {
  _sets: object;
}

export type ValueProcessingStep = (this: DefaultLayoutService, v: SankeyData) => IntermediateProcessedData | undefined;

export interface ValueGenerator {
  preprocessing: ValueProcessingStep;
  postprocessing?: ValueProcessingStep;
  // not used yet
  requires?: any;
}

export interface MultiValueAccessor extends ValueAccessor {
  linkValueAccessorId: string;
  nodeValueAccessorId: string;
  type: LINK_PROPERTY_GENERATORS;
}

export interface Prescaler {
  name: string;
  description: string;
  fn: (v: number) => number;
}

export interface Palette {
  name: string;
  palette: (size: number, params: object) => (i: number) => string | object;
  help?: string;
}


export interface NodeValueAccessor {
  [nodeValuePropertyName: string]: ValueAccessor;
}

export interface LinkValueAccessor {
  [linkValuePropertyName: string]: ValueAccessor;
}

export type PREDEFINED_VALUE_ACCESSORS = {
  [linkValueGeneratorId in PREDEFINED_VALUE | string]?: MultiValueAccessor
};

export enum LINK_VALUE_GENERATOR {
  fixedValue0 = 'Fixed Value = 0',
  fixedValue1 = 'Fixed Value = 1',
  input_count = 'Input count',
  fraction_of_fixed_node_value = 'Fraction of fixed node value',
}

export enum LINK_PROPERTY_GENERATORS {
  byArrayProperty = 'By Array Property',
  byProperty = 'By Property',
}

type LINK_VALUE_GENERATORS = {
  [linkValueGeneratorId in LINK_VALUE_GENERATOR]?: ValueAccessor
};

type NODE_VALUE_GENERATORS = {
  [linkValueGeneratorId in NODE_VALUE_GENERATOR]: ValueAccessor
};

export enum NODE_VALUE_GENERATOR {
  none = 'None',
  fixedValue1 = 'Fixed Value = 1'
}

export enum PREDEFINED_VALUE {
  fixed_height = 'Fixed height',
  input_count = 'Input count'
}

export interface SankeyStaticOptions {
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
  // initial state for base view
  baseViewInitState?: object;
}

// endregion


export interface SankeyTraceNetwork extends GraphTraceNetwork {
  traces: Array<SankeyTrace>;
}

export interface SankeyGraph extends GraphGraph {
  trace_networks: Array<SankeyTraceNetwork>;
}

export interface SankeyLinksOverwrites {
  [linkId: string]: Partial<GraphLink>;
}

export interface SankeyNodesOverwrites {
  [nodeId: string]: Partial<GraphNode>;
}

export interface SankeyView {
  state: object & SankeyState;
  base: ViewBase;
  size: ViewSize;
  nodes: SankeyNodesOverwrites;
  links: SankeyLinksOverwrites;
}

export type SankeyApplicableView = RecursivePartial<SankeyView> & Pick<SankeyView, 'base'>;

export interface SankeyViews {
  [viewName: string]: SankeyView;
}

export interface SankeyData extends GraphFile {
  graph: SankeyGraph;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;

  sources?: Array<number>;
  targets?: Array<number>;

  _views: SankeyViews;
}

// endregion

export enum SankeyURLLoadParam {
  NETWORK_TRACE_IDX = 'network_trace',
  VIEW_NAME = 'view',
  BASE_VIEW_NAME = 'base_view',
  SEARCH_TERMS = 'search_terms',
}

export interface SankeyURLLoadParams {
  [SankeyURLLoadParam.NETWORK_TRACE_IDX]: number;
  [SankeyURLLoadParam.VIEW_NAME]?: string;
  [SankeyURLLoadParam.BASE_VIEW_NAME]?: string;
  [SankeyURLLoadParam.SEARCH_TERMS]?: string;
}

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
  entity: SankeyTrace;
};

// endregion

// region Path report
export interface SankeyPathReportEntity {
  label: string;
  row: number;
  column: number;
  type: 'node' | 'link' | 'spacer';
}

export interface SankeyPathReport {
  [networkTrace: string]: SankeyPathReportEntity[][];
}

// endregion

// Do not change these strings! They are tightly coupled with urls.
export enum ViewBase {
  sankeyMultiLane = 'sankey',
  sankeySingleLane = 'sankey-many-to-many'
}

export interface NetworkTraceData {
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;
  sources: SankeyId[];
  targets: SankeyId[];
}

export interface ViewSize {
  width: number;
  height: number;
}
