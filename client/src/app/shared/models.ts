import { CollectionModal } from './utils/collection-modal';
import { ResultQuery } from './schemas/common';

export class ModalList<T> {
  public collectionSize = 0;
  public readonly results = new CollectionModal<T>([], {
    multipleSelection: true,
  });
  public query: ResultQuery | undefined;
}
