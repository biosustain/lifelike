export interface AnnotationFilterEntity {
  id: string;
  color: string;
  text: string;
  frequency: number;
}

export interface WordCloudAnnotationFilterEntity extends AnnotationFilterEntity {
  shown: boolean;
  synonyms?: string[];
}

export enum DefaultGroupByOptions {
  NONE = 'None',
  ENTITY_TYPE = 'Entity Type',
  ANNOTATION_TYPE = 'Annotation Type (Manual vs. Automatic)'
}

export enum DefaultOrderByOptions {
  FREQUENCY = 'Frequency',
  FILTERED = 'Filtered',
}

export enum OrderDirection {
  ASCENDING = 'Ascending',
  DESCENDING = 'Descending'
}
