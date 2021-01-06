import { AppUser } from '../../interfaces';
import { RecursivePartial } from '../../shared/utils/types';
import { ObjectVersionData } from '../schema';
import { CollectionModel } from '../../shared/utils/collection-model';
import { FilesystemObject } from './filesystem-object';
import { cloneDeep } from 'lodash';
import { ModelList } from '../../shared/models';

export class ObjectVersion {
  hashId: string;
  message?: string;
  user: AppUser;
  creationDate: string;
  _originalObject?: FilesystemObject;
  _contentValue?: Blob;
  _cachedObject: FilesystemObject;

  get originalObject(): FilesystemObject {
    return this._originalObject;
  }

  set originalObject(value: FilesystemObject) {
    this._originalObject = value;
    this._cachedObject = null;
  }

  get contentValue(): Blob {
    return this._contentValue;
  }

  set contentValue(value: Blob) {
    this._contentValue = value;
    this._cachedObject = null;
  }

  get object(): FilesystemObject | undefined {
    if (!this.originalObject || !this.contentValue) {
      return null;
    }
    if (!this._cachedObject) {
      this._cachedObject = this.toObject();
    }
    return this._cachedObject;
  }

  toObject(): FilesystemObject {
    if (!this.originalObject || !this.contentValue) {
      throw new Error('need originalObject and contentValue to generate a fake object');
    }
    const object = cloneDeep(this.originalObject);
    object.contentValue = this.contentValue;
    return object;
  }

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

export class ObjectVersionHistory extends ModelList<ObjectVersion> {
}
