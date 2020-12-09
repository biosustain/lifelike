import { AppUser } from '../interfaces';
import { AnnotationChangeExclusionMeta, Meta } from '../pdf-viewer/annotation-type';
import { ResultList } from '../shared/schemas/common';

// ========================================
// Locks
// ========================================

export interface ObjectLockData {
  user: AppUser;
  acquireDate: string;
}

// ========================================
// Annotation history
// ========================================

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
