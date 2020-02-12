import { IdType } from 'vis-network';

export interface GroupRequest {
    relationship: string;
    node: IdType;
}

export interface GetLabelsResult {
    validLabels: Set<string>;
    invalidLabels: Set<string>;
}
