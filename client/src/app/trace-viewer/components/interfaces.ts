import visNetwork from 'vis-network';

import Graph from 'app/shared/providers/graph-type/interfaces';

/**
 * visNetwork.Node interface extended with:
 * + properties used to calculate initial layout
 * + optional data from GraphNode
 */
export interface TraceNode extends visNetwork.Node,
  // GraphNode id collides with visNetwork.Node id
  Partial<Omit<Graph.Node, 'id'>> {
  _visited?: boolean;
  _fromEdges?: Array<TraceEdge>;
  _toEdges?: Array<TraceEdge>;
  label?: string;
  fullLabel?: string;
  labelShort?: string;
}

/**
 * visNetwork.Edge interface extended with:
 * + properties used to calculate initial layout
 * + optional data from GraphLink
 */
export interface TraceEdge extends visNetwork.Edge, Partial<Graph.Link> {
  _visited?: boolean;
  _fromObj?: TraceNode;
  _toObj?: TraceNode;
}


export interface TraceData {
  nodes: TraceNode[];
  edges: TraceEdge[];
  source: number;
  target: number;
}
