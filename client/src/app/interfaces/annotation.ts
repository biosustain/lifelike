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

export type AnnotationMethods = 'NLP' | 'Rules Based';
export const ANNOTATIONMODELS = new Set(
    ['Anatomy', 'Chemical', 'Compound', 'Disease', 'Food', 'Gene',
    'Phenomena', 'Phenotype', 'Phenotype', 'Protein', 'Species']);
