export interface AnnotationFilterEntity {
  id: string;
  type: string;
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
  // TODO: Might want to have this later, right now the API response for the combined annotations doesn't tell us what kind each row is
  // ANNOTATION_TYPE = 'Annotation Type (Manual vs. Automatic)'
}

export enum DefaultOrderByOptions {
  FREQUENCY = 'Frequency',
  FILTERED = 'Filtered',
}

export enum OrderDirection {
  ASCENDING = 'Ascending',
  DESCENDING = 'Descending'
}
