import { ResultList } from '../interfaces/shared.interface';
import { AnnotationChangeExclusionMeta, Meta } from '../pdf-viewer/annotation-type';

export interface AnnotationChangeData {
  action: 'added' | 'removed';
}

export interface AnnotationInclusionChangeData extends AnnotationChangeData {
  meta: Meta;
}

export interface AnnotationExclusionChangeData extends AnnotationChangeData {
  meta: AnnotationChangeExclusionMeta;
}

export interface FileAnnotationChangeData {
  date: string;
  cause: 'user' | 'user_reannotation' | 'sys_reannotation';
  inclusionChanges: AnnotationInclusionChangeData[];
  exclusionChanges: AnnotationExclusionChangeData[];
}

export interface FileAnnotationHistoryResponse extends ResultList<FileAnnotationChangeData> {
}
