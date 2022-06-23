export interface GraphNode {
  id: number;
  labels?: Array<string>;
  description?: string;
  schemaClass?: string;
  type?: string;
  oldStId?: string;
  isInDisease?: boolean;
  displayName?: string;
  stIdVersion?: string;
  dbId?: number;
  name?: string | Array<string>;
  referenceType?: string;
  stId?: string;
  endoHigh?: boolean;
  endo?: boolean;
  pageUpdown?: number;
  pageMetab?: number;
  label?: string;
  speciesName?: string;
  startCoordinate?: number;
  endCoordinate?: number;
  isChimeric?: boolean;
  biocyc_id?: string;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphLinkEdge {
  types: Array<string>;
  nodes: Array<number>;
  left: boolean;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphLink {
  description: string;
  source: number;
  target: number;
  label: string;

  key?: number;
  inedge?: GraphLinkEdge;
  outedge?: GraphLinkEdge;
  node?: number;
  pageUpdown?: number;
  '1/pageUpdown'?: number | string;
  pageMetab?: number;
  '1/pageMetab'?: number | string;
  NLG?: string;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphSizingGroup {
  link_sizing?: string;
  node_sizing?: string;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphPredefinedSizing {
  [key: string]: GraphSizingGroup;
}

export interface GraphDetailEdge {
  type: string;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphTrace {
  node_paths: Array<Array<number>>;
  edges: Array<number>;
  source: number;
  target: number;
  group: number;

  detail_edges?: Array<[number, number, GraphDetailEdge]>;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphTraceNetwork {
  sources: string;
  targets: string;
  description: string;
  name?: string;
  traces: Array<GraphTrace>;

  method?: string;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphNodeSets {
  [key: string]: Array<number>;
}

export interface GraphGraph {
  node_sets: GraphNodeSets;
  description: string;
  trace_networks: Array<GraphTraceNetwork>;
  name?: string;
  sizing?: GraphPredefinedSizing;
  log?: string | Array<string>;

  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

export interface GraphFile {
  directed: boolean;
  multigraph: boolean;
  graph: GraphGraph;

  nodes: Array<GraphNode>;
  links: Array<GraphLink>;
  // by design all objects can have dynamic properties however this code should not be concerned about them
  // [key: string]: any;
}

// tslint:disable-next-line:no-namespace
namespace GraphNS {
  export type File = GraphFile;
  export type Graph = GraphGraph;
  export type NodeSets = GraphNodeSets;
  export type TraceNetwork = GraphTraceNetwork;
  export type Trace = GraphTrace;
  export type DetailEdge = GraphDetailEdge;
  export type PredefinedSizing = GraphPredefinedSizing;
  export type SizingGroup = GraphSizingGroup;
  export type Link = GraphLink;
  export type LinkEdge = GraphLinkEdge;
  export type Node = GraphNode;
}

/**
 * Allows to import namespace so instead of makeing long list of prefixed interfaces,
 * you can simply import prefix (namespace)
 * Example:
 * import { GraphFile, GraphGraph, GraphTraceNetwork, GraphTrace, GraphNodeSets } from 'app/shared/providers/graph-type/interfaces';
 * const graphFile: GraphFile;
 * Into:
 * import Graph from 'app/shared/providers/graph-type/interfaces';
 * const graphFile: Graph.File;
 */
export default GraphNS;
