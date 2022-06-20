import { Injectable } from '@angular/core';

import { DataTransferData, DataTransferDataProvider, DataTransferToken } from 'app/shared/services/data-transfer-data.service';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';

import { UniversalGraphNode } from '../services/interfaces';

export const IMAGE_TOKEN = new DataTransferToken<string>('imageHash');
export const FILESYSTEM_IMAGE_TRANSFER_TYPE = 'vnd.lifelike.transfer/image-node';
export const FILESYSTEM_IMAGE_HASHID_TYPE = 'vnd.lifelike.transfer/image-hash';


@Injectable()
export class ImageEntityDataProvider implements DataTransferDataProvider {

  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }


  extract(dataTransfer: DataTransfer): DataTransferData<ImageTransferData>[] {

    const imageData = dataTransfer.getData(FILESYSTEM_IMAGE_TRANSFER_TYPE);
    const hash = dataTransfer.getData(FILESYSTEM_IMAGE_HASHID_TYPE);
    if (imageData) {
      const node = JSON.parse(imageData) as UniversalGraphNode;
      return [{
        token: IMAGE_TOKEN,
        data: {
          node,
          hash
        },
        confidence: 100
      }];
    }
    return [];
  }
}

export interface ImageTransferData {
  node: UniversalGraphNode;
  hash: string;
}
