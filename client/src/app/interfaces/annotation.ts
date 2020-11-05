export interface InclusionMeta {
    allText: string;
    color: string;
    id: string;
    idHyperlink: string;
    includeGlobally: boolean;
    isCustom: boolean;
    links: object;
    primaryLink: string;
    type: string;
}

export interface GlobalAnnotation {
    id: number;
    file_id: string;
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
