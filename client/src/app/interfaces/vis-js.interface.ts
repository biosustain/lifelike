import { Edge, Node } from 'vis-network';
import { DataSet } from 'vis-data';

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface VisNetworkDataSet {
  nodes: DataSet<Node, 'id'>;
  edges: DataSet<Edge, 'id'>;
}
