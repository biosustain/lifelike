import { IdType } from 'vis-network';

export interface GroupRequest {
    relationship: string;
    node: IdType;
}

export interface GetLabelsResult {
    validLabels: Set<string>;
    invalidLabels: Set<string>;
}

export interface SidenavEntity {
    data: any;
}

export interface SidenavNodeEntity extends SidenavEntity {
    edges: any[];
}

export interface SidenavEdgeEntity extends SidenavEntity {
    to: any;
    from: any;
    references: any;
}

export interface SidenavClusterEntity extends SidenavEntity {
    includes: any[];
    referencesMap: any;
}
