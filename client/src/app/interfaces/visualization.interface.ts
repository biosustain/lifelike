import { IdType } from 'vis-network';

import { GraphRelationship, VisNode } from './neo4j.interface';

export interface AssociationData {
    fromNode: number;
    toNode: number;
    association: string;
}

export interface AssociationSnippet {
    entry1Text: string;
    entry2Text: string;
    id: string;
    score: number;
    sentence: string;
}

export interface GroupRequest {
    relationship: string;
    node: IdType;
}

export interface GetLabelsResult {
    validLabels: Set<string>;
    invalidLabels: Set<string>;
}

export interface GetSnippetsResult {
    references: AssociationSnippet[];
    fromNode: number;
    toNode: number;
    association: string;
}

export interface ReferenceTableRow {
    node: VisNode;
    edges: GraphRelationship[];
}

export interface ReferenceTableSelection {
    referenceTableRow: ReferenceTableRow;
    edgeLabel: string;
}

export interface SidenavEntity {
    data: VisNode | GraphRelationship;
}

export interface SidenavNodeEntity extends SidenavEntity {
    edges: GraphRelationship[];
}

export interface SidenavEdgeEntity extends SidenavEntity {
    to: VisNode;
    from: VisNode;
    association: string;
    references: AssociationSnippet[];
}

export interface SidenavClusterEntity extends SidenavEntity {
    includes: VisNode[];
    referencesMap: Map<IdType, number>;
}
