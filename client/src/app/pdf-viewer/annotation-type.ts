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
  includeGlobally?: boolean;
  isCaseInsensitive?: boolean;
}

export type Rect = number[];

export interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
  uuid?: string;
  textInDocument?: string;
}

export interface RemovedAnnotationExclusion {
  type: string;
  text: string;
}

export interface AddedAnnotationExclusion {
  type: string;
  text: string;
  id: string;
  idHyperlink: string;
  reason: string;
  comment: string;
  rects: Rect[];
  pageNumber: number;
  excludeGlobally: boolean;
  isCaseInsensitive: boolean;
}
