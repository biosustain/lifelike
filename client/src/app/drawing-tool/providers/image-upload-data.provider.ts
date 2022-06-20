import { Injectable } from '@angular/core';

import { DataTransferData, DataTransferDataProvider, DataTransferToken } from 'app/shared/services/data-transfer-data.service';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';

import { UniversalGraphNode } from '../services/interfaces';

export const IMAGE_UPLOAD_TOKEN = new DataTransferToken<string>('imageBlob');


@Injectable()
export class ImageUploadDataProvider implements DataTransferDataProvider {

  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }


  extract(dataTransfer: DataTransfer): DataTransferData<File>[] {
    const dtItem = dataTransfer.items[0];
    // TODO: map with reduce
    if (dtItem?.type.startsWith('image/')) {
      return [{
        token: IMAGE_UPLOAD_TOKEN,
        data: dtItem.getAsFile(),
        confidence: 0,
      }];
    }

    return [];
  }
}
