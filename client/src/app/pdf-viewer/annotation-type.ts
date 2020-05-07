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
  isCustom?: boolean;
  allText?: string;
  links?: Links;
  hyperlink?: string;
}

export type Rect = number[];

export interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
}
