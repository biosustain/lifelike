import { CollectionModal } from '../../shared/utils/collection-modal';
import { FilesystemObject } from './filesystem-object';

export class FilesystemObjectList {
  public collectionSize = 0;
  public readonly results = new CollectionModal<FilesystemObject>([], {
    multipleSelection: true,
  });
}
