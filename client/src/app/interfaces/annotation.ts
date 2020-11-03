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

export interface GlobalInclusion {
    inclusion_date: string;
    keywords: string[];
    meta: InclusionMeta;
    pageNumber: number;
    rects: number[][];
    user_id: number;
    uuid: string;
}

export interface GlobalExclusion {
    comment: string;
    excludeGlobally: boolean;
    exclusion_date: string;
    id: string;
    idHyperlink: string;
    pageNumber: number;
    reason: string;
    rects: number[][];
    text: string;
    type: string;
    user_id: number;
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
    annotation: GlobalExclusion | GlobalInclusion;
}

export interface GlobalAnnotationRow {
    pid: number;
    text: string;
    type: string;
    filename: string;
    addedBy: string;
    creationDate: string;
    reason: string;
    entityType: string;
    annotationId: string;
}
