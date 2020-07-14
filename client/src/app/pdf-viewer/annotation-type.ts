export interface Location {
  pageNumber: number;
  rect: Rect;
}

export interface Links {
  ncbi?: string;
  uniprot?: string;
  wikipedia?: string;
  google?: string;
}

export interface Meta {
  type: string;
  color: string;
  id?: string;
  idType?: string;
  idHyperlink?: string;
  isCustom?: boolean;
  allText?: string;
  links?: Links;
  isExcluded?: boolean;
  exclusionReason?: string;
  exclusionComment?: string;
  primaryLink?: string;
}

export type Rect = number[];

export interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
  uuid?: string;
}

export interface AnnotationExclusionData {
  id: string;
  reason: string;
  comment: string;
}
