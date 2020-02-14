import { IdType } from 'vis-network';

import { GraphNode, GraphRelationship, AssociationSentence } from './neo4j.interface';

export interface GroupRequest {
    relationship: string;
    node: IdType;
}

export interface GetLabelsResult {
    validLabels: Set<string>;
    invalidLabels: Set<string>;
}

export interface SidenavEntity {
    data: GraphNode | GraphRelationship;
}

export interface SidenavNodeEntity extends SidenavEntity {
    edges: GraphRelationship[];
}

export interface SidenavEdgeEntity extends SidenavEntity {
    to: GraphNode;
    from: GraphNode;
    references: AssociationSentence;
}

export interface SidenavClusterEntity extends SidenavEntity {
    includes: GraphNode[];
    referencesMap: Map<IdType, number>;
}
