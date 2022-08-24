import { Injectable } from '@angular/core';

import { DataTransferData, DataTransferDataProvider, DataTransferToken } from 'app/shared/services/data-transfer-data.service';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { IMAGE_LABEL } from 'app/shared/constants';

import { IMAGE_TOKEN, ImageTransferData } from './image-entity-data.provider';
import { UniversalGraphNode } from '../services/interfaces';

export const IMAGE_UPLOAD_TOKEN = new DataTransferToken<string>('imageBlob');


@Injectable()
export class ImageUploadDataProvider implements DataTransferDataProvider<ImageTransferData> {
  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }

  extract(dataTransfer: DataTransfer): DataTransferData<ImageTransferData>[] {
    const imageItems = [];
    for (const item of Array.from(dataTransfer.items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        imageItems.push({
          token: IMAGE_TOKEN,
          data: {
            blob: file as Blob,
            node: {
              display_name: file.name,
              label: IMAGE_LABEL,
              sub_labels: [],
              data: {}
            } as Partial<UniversalGraphNode>,
          },
          confidence: 90,
        });
      }
    }

    return imageItems;
  }
}
