import {
  AnnotationChangeData,
  AnnotationExclusionChangeData,
  AnnotationInclusionChangeData,
  FileAnnotationChangeData,
  FileAnnotationHistoryResponse,
} from '../schema';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { AnnotationChangeExclusionMeta, Meta } from '../../pdf-viewer/annotation-type';
import { startCase } from 'lodash';

class AnnotationChange {
  action: 'added' | 'removed';

  /**
   * Get a friendly label describing this change.
   */
  get label(): string {
    return startCase(this.action);
  }

  update(data: AnnotationChangeData): AnnotationChange {
    this.action = data.action;
    return this;
  }
}

/**
 * A change in annotation inclusions.
 */
export class AnnotationInclusionChange extends AnnotationChange {
  meta: Meta;

  update(data: AnnotationInclusionChangeData): AnnotationInclusionChange {
    super.update(data);
    this.meta = data.meta;
    return this;
  }
}

/**
 * A change in annotation exclusions.
 */
export class AnnotationExclusionChange extends AnnotationChange {
  meta: AnnotationChangeExclusionMeta;

  update(data: AnnotationExclusionChangeData): AnnotationExclusionChange {
    super.update(data);
    this.meta = data.meta;
    return this;
  }
}

/**
 * A group of annotations change made together.
 */
export class FileAnnotationChange {
  date: string;
  cause: 'user' | 'user_reannotation' | 'sys_reannotation';
  inclusionChanges: AnnotationInclusionChange[];
  exclusionChanges: AnnotationExclusionChange[];

  /**
   * Get a friendly label describing this cause.
   */
  get causeLabel(): string {
    switch (this.cause) {
      case 'user':
        return 'User';
      case 'user_reannotation':
        return 'Re-annotation';
      case 'sys_reannotation':
        return 'Automatic';
      default:
        return this.cause;
    }
  }

  update(data: FileAnnotationChangeData): FileAnnotationChange {
    this.date = data.date;
    this.cause = data.cause;
    this.inclusionChanges = data.inclusionChanges.map(
      itemData => new AnnotationInclusionChange().update(itemData));
    this.exclusionChanges = data.exclusionChanges.map(
      itemData => new AnnotationExclusionChange().update(itemData));
    return this;
  }
}

/**
 * A log of changes to annotations for a file.
 * @see FilesystemService#getAnnotationHistory
 */
export class FileAnnotationHistory {
  public collectionSize = 0;
  public readonly results = new CollectionModal<FileAnnotationChange>([], {
    multipleSelection: false,
  });

  update(data: FileAnnotationHistoryResponse): FileAnnotationHistory {
    this.collectionSize = data.total;
    this.results.replace(data.results.map(
      itemData => new FileAnnotationChange().update(itemData)));
    return this;
  }
}
