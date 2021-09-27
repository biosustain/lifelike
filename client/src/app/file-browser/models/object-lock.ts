import { RecursivePartial } from 'app/shared/utils/types';

import { ObjectLockData } from '../schema';
import { AppUser } from '../../interfaces';

export class ObjectLock {
  user: AppUser;
  acquireDate: string;

  update(data: RecursivePartial<ObjectLockData>): ObjectLock {
    if (data == null) {
      return this;
    }
    for (const key of ['user', 'acquireDate']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    return this;
  }
}
