import { CollectionModal } from './utils/collection-modal';

export class ModalList<T> {
  public collectionSize = 0;
  public readonly results = new CollectionModal<T>([], {
    multipleSelection: true,
  });
}
