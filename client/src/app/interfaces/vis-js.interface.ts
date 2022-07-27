import { DataSet } from 'vis-data';
import { Color, Edge, Network, Node, Options } from 'vis-network/dist/vis-network';

export interface NodeWithCustomParameters extends Node {
  _initialBorderWidth?: number;
  _initialColor?: Color;
}

// tslint:disable-next-line:no-empty-interface
export interface EdgeWithCustomParameters extends Edge {
}

export interface GraphData {
  nodes: NodeWithCustomParameters[];
  edges: EdgeWithCustomParameters[];
}

export interface VisNetworkDataSet {
  nodes: DataSet<NodeWithCustomParameters, 'id'>;
  edges: DataSet<EdgeWithCustomParameters, 'id'>;
}
