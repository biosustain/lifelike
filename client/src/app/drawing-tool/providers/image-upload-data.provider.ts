import { Injectable } from '@angular/core';

import { DataTransferData, DataTransferDataProvider, DataTransferToken } from 'app/shared/services/data-transfer-data.service';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';

export const IMAGE_UPLOAD_TOKEN = new DataTransferToken<string>('imageBlob');


@Injectable()
export class ImageUploadDataProvider implements DataTransferDataProvider {

  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }


  extract(dataTransfer: DataTransfer): DataTransferData<File>[] {

    const imageItems = [];
    // Review note: This is bad, cast this somehow?
    // dataTransfer.items are not an array, but a specific object that does not implement array properties, so we cannot use
    // item of items or items.filter()
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < dataTransfer.items.length; ++i) {
      const item = dataTransfer.items[i];
      if (item.type.startsWith('image/')) {
        imageItems.push({
          token: IMAGE_UPLOAD_TOKEN,
          data: item.getAsFile(),
          confidence: 80,
      });
      }
    }

    return imageItems;
  }
}
