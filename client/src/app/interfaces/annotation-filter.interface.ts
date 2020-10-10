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
