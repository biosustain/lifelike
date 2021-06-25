export interface InclusionMeta {
    allText: string;
    id: string;
    idHyperlink: string;
    includeGlobally: boolean;
    isCustom: boolean;
    links: object;
    type: string;
}

export interface GlobalAnnotation {
    globalId: number;
    creator: string;
    fileHashId: string;
    fileDeleted: boolean;
    fileReference: string;
    type: string;
    creationDate: string;
    text: string;
    caseInsensitive: boolean;
    entityType: string;
    entityId: string;
    reason: string;
    comment: string;
}

export type AnnotationMethods = 'NLP' | 'Rules Based';
export const NLPANNOTATIONMODELS = new Set(['Chemical', 'Disease', 'Gene']);
