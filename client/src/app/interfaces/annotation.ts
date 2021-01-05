export interface InclusionMeta {
    allText: string;
    color: string;
    id: string;
    idHyperlink: string;
    includeGlobally: boolean;
    isCustom: boolean;
    links: object;
    type: string;
}

export interface GlobalAnnotation {
    id: number;
    file_id: number;
    filename: string;
    userEmail: string;
    type: string;
    reviewed: boolean;
    approved: boolean;
    creationDate: string;
    modifiedDate: string;
    text: string;
    reason: string;
    entityType: string;
    annotationId: string;
    comment: string;
}

export type AnnotationMethod = 'NLP' | 'Rules Based';
