import { IdType } from 'vis-network';

import { GraphNode, VisEdge, VisNode, DuplicateVisNode, DuplicateVisEdge } from './neo4j.interface';

export enum Direction {
    TO = 'Incoming',
    FROM = 'Outgoing',
}

export interface AssociationSnippet {
    reference: Reference;
    publication: Publication;
}

export interface Publication extends GraphNode {
    data: {
        journal: string;
        title: string;
        pmid: string;
        pubYear: number;
    };
}

export interface Reference extends GraphNode {
    data: {
        entry1Text: string;
        entry2Text: string;
        id: string;
        sentence: string;
    };
}

export interface ClusteredNode {
    nodeId: number;
    edges: DuplicateVisEdge[];
}

export interface ExpandNodeRequest {
    nodeId: number;
    filterLabels: string[];
}

export interface ExpandNodeResult {
    expandedNode: number;
    nodes: VisNode[];
    edges: VisEdge[];
}

export interface GetClusterGraphDataResult {
    results: {
        // Node ID
        [key: number]: {
            // Edge label : Snippet count
            [key: string]: number
        }
    };
}

export interface GetClusterSnippetDataResult {
    results: GetSnippetsResult[];
}

export interface GetClusterDataResult {
    graphData: GetClusterGraphDataResult;
    snippetData: GetClusterSnippetDataResult;
}

export interface GroupRequest {
    relationship: string;
    node: IdType;
    direction: Direction;
}

export interface GetLabelsResult {
    labels: Set<string>;
}

export interface GetSnippetsResult {
    snippets: AssociationSnippet[];
    fromNodeId: number;
    toNodeId: number;
    association: string;
}

export interface EdgeSnippetCount {
    edge: VisEdge;
    count: number;
}

export interface GetSnippetCountsFromEdgesResult {
    edgeSnippetCounts: EdgeSnippetCount[];
}

export interface NodeEdgePair {
    node: VisNode;
    edge: VisEdge;
}

export interface DuplicateNodeEdgePair {
    node: DuplicateVisNode;
    edge: DuplicateVisEdge;
}

export interface ReferenceTableRow {
    nodeId: string;
    nodeDisplayName: string;
    snippetCount: number;
    edge: VisEdge;
}

export interface GetReferenceTableDataResult {
    referenceTableRows: ReferenceTableRow[];
}


export interface SidenavSnippetData {
    to: VisNode;
    from: VisNode;
    association: string;
    snippets: AssociationSnippet[];
}

export interface SidenavNodeEntity {
    data: VisNode;
    edges: VisEdge[];
}

export interface SidenavEdgeEntity {
    data: SidenavSnippetData;
}

export interface SidenavClusterEntity {
    data: SidenavSnippetData[];
}
