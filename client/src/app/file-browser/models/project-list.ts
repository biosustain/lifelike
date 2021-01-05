import { CollectionModal } from '../../shared/utils/collection-modal';
import { ProjectImpl } from './filesystem-object';

export class ProjectList {
  public collectionSize = 0;
  public readonly results = new CollectionModal<ProjectImpl>([], {
    multipleSelection: true,
  });
}
