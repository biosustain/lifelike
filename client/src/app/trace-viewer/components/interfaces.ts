import visNetwork from 'vis-network';
import { SankeyNode } from '../../sankey-viewer/components/interfaces';

export interface LinkedNode {
  fromEdges: Array<any>;
  toEdges: Array<any>;
}

export type IntermediateNodeType = visNetwork.Node & SankeyNode & LinkedNode;
