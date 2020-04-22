export type Location = {
    pageNumber:number;
    rect: Rect;
}

export type Links = {
    ncbi?: string;
    uniprot?: string;
    wikipedia?: string;
    google?: string;
}

export type Meta = {
    type:string;
    color:string;
    id?:string;
    idType?: string;
    isCustom?: boolean;
    allText?: string;
    links?: Links;
}

export type Rect = number[];

export type Annotation = {
    pageNumber: number;
    keywords: string[];
    rects: Rect[];
    meta: Meta;
}
