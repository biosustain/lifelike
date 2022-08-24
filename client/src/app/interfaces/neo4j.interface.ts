import { ColorObject } from 'vis-network/dist/types/network/gephiParser';

export interface NodeLegend {
    [key: string]: {
        color: string;
        label: string;
    };
}

export type DefaultNodeData = Record<string, any>&{eid: any};
/** Node representation from the backend */
export interface GraphNode<Data = DefaultNodeData> {
  id: number;
  label: string;
  data: Data;
  subLabels: Array<string>;
  displayName: string;
  domainLabels: string[];
  entityUrl: string;
}

/** Edge represenattion from the backend */
export interface GraphRelationship<Data = Record<string, any>> {
  id: number;
  label: string;
  data: Data;
  to: number;
  from: number;
  toLabel: string;
  fromLabel: string;
}

/** VisJS Node Representations for Client */
export interface VisNode<Data = DefaultNodeData> extends GraphNode<Data> {
  primaryLabel?: string; // Label to display in VisJS
  color: ColorObject; // VisJS color options
  font: any; // VisJS font options
  expanded?: boolean; // Whether a node has been expanded
}

export interface DuplicateVisNode<Data = DefaultNodeData> extends VisNode<Data> {
    id: any;
    duplicateOf: number;
}

/** VisJS Edge Representations for Client */
export interface VisEdge<Data = Record<string, any>> extends GraphRelationship<Data> {
  arrows?: string;
  color: any;
}

// TODO: For DuplicateVisEdge, `to` and `from` are actually string types in the shape 'duplicateEdge:{hash}'.
// We may want to update this interface so the type is reflected properly.
export interface DuplicateVisEdge<Data = Record<string, any>> extends VisEdge<Data> {
    id: any;
    duplicateOf: number | null;
    originalFrom: number | null;
    originalTo: number | null;
}

export interface Neo4jResults<NodeData = DefaultNodeData, EdgeData = Record<string, any>> {
  nodes: Array<GraphNode<NodeData> | VisNode<NodeData>>;
  edges: Array<GraphRelationship<EdgeData> | VisEdge<EdgeData>>;
}

// Used for vis.js configuration
// https://visjs.github.io/vis-network/docs/network/configure.html#
export interface Neo4jGraphConfig {
  [key: string]: any;
}

export interface AssociationSentence {
    entry1Text: string;
    entry2Text: string;
    id: string;
    sentence: string;
}

export interface FTSQueryRecord<Data = Record<string, any>> {
  node: GraphNode<Data>;
  taxonomyId?: number;
  taxonomyName?: string;
  goClass?: string;
}

export interface FTSReferenceRecord<Data = DefaultNodeData> extends FTSQueryRecord<Data> {
  publicationTitle: string;
  publicationYear: number;
  publicationId: number;
  relationship: string;
  chemical?: GraphNode<Data>;
  disease?: GraphNode<Data>;
}

export interface FTSResult<Data = Record<string, any>> {
  query: string;
  nodes: Array<FTSQueryRecord<Data>>;
  total: number;
  page: number;
  limit: number;
}

export interface SearchRecord {
  nodeId: number;
  label: string;
  subLabels: Array<string>;
  data: string;
  dataId: string;
}

export interface OrganismsResult {
  limit: number;
  nodes: OrganismAutocomplete[];
  query: string;
  total: number;
}

export interface OrganismAutocomplete {
  organism_name: string;
  synonym: string;
  tax_id: string;
}

export interface Domain {
  id: string;
  name: string;
  label: string;
}

export interface EntityType {
  id: string;
  name: string;
  label: string;
}
