import { CollectionModal } from '../../shared/utils/collection-modal';
import { Project } from '../services/project-space.service';

export class ProjectList {
  public collectionSize = 0;
  public readonly results = new CollectionModal<Project>([], {
    multipleSelection: true,
  });
}
