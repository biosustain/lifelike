import { AppUser } from '../../interfaces';
import { RecursivePartial } from '../../shared/utils/types';
import { ObjectVersionData } from '../schema';
import { CollectionModal } from '../../shared/utils/collection-modal';

export class ObjectVersion {
  hashId: string;
  message?: string;
  user: AppUser;
  creationDate: string;

  update(data: RecursivePartial<ObjectVersionData>): ObjectVersion {
    if (data == null) {
      return this;
    }
    for (const key of ['hashId', 'message', 'user', 'creationDate']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    return this;
  }
}

export class ObjectVersionList {
  public collectionSize = 0;
  public readonly results = new CollectionModal<ObjectVersion>([], {
    multipleSelection: true,
  });
}
