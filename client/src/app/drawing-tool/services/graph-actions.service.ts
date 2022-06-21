import { Injectable } from '@angular/core';

import { of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import { IMAGE_DEFAULT_SIZE, IMAGE_LABEL, MimeTypes } from 'app/shared/constants';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { Point } from 'app/graph-viewer/utils/canvas/shared';

import { MapImageProviderService } from './map-image-provider.service';
import { extractGraphEntityActions } from '../utils/data';
import { IMAGE_TOKEN, ImageTransferData } from '../providers/image-entity-data.provider';
import { IMAGE_UPLOAD_TOKEN } from '../providers/image-upload-data.provider';

@Injectable()
export class GraphActionsService {

  constructor(readonly mapImageProviderService: MapImageProviderService,
              readonly filesystemService: FilesystemService) { }

  async fromDataTransferItems(items: DataTransferData<any>[], hoverPosition: Point, parentId: string): Promise<GraphAction[]> {

    let actions = extractGraphEntityActions(items, hoverPosition);
    items = await this.processImageUpload(items, parentId);
    actions = await this.processImageItems(items, hoverPosition, actions);

    return actions;
  }

  async processImageItems(items: DataTransferData<any>[], {x, y}: Point, actions: GraphAction[]) {
    const imageItems = items.filter(item => item.token === IMAGE_TOKEN);

    let node;
    const imageId = makeid();
    await of(...imageItems).pipe(
      switchMap(item => {
        const data = item.data as ImageTransferData;
        node = data.node;
        return this.filesystemService.getContent(data.hash);
      }),
      switchMap(blob => {
          return this.mapImageProviderService.doInitialProcessing(imageId, new File([blob], imageId));
      }),
      take(imageItems.length),
      map(dimensions => {
      // Scale smaller side up to 300 px
      const ratio = IMAGE_DEFAULT_SIZE / Math.min(dimensions.width, dimensions.height);
      return (new NodeCreation(`Insert image`, {
        ...node,
        hash: uuidv4(),
        image_id: imageId,
        label: IMAGE_LABEL,
        data: {
          ...node.data,
          x,
          y,
          width: dimensions.width * ratio,
          height: dimensions.height * ratio,
        },
      }, true));
    }),
    tap(action => actions.push(action)),
    ).toPromise();

    return actions;
  }

  async processImageUpload(items: DataTransferData<any>[], parentId: string) {
    const imageUploadItems = items.filter(item => item.token === IMAGE_UPLOAD_TOKEN);
    for (const imageUploadItem of imageUploadItems) {
      const file = imageUploadItem.data as File;
      const res = await this.filesystemService.create({
        mimeType: file.type,
        filename: file.name,
        parentHashId: parentId,
        contentValue: file as Blob,
      }).toPromise();
      items.push({
        token: IMAGE_TOKEN,
        data: {
          node: {
            display_name: file.name,
            label: IMAGE_LABEL,
            sub_labels: [],
            // Review Note: Do we want to remove that? It's not like we can do much with a link to an image
            data: {
              sources: [{
                domain: file.name,
                url: res.bodyValue?.getURL()
              }]
            }
          },
          hash: res.bodyValue?.hashId
        },
        confidence: 100,
      });
    }
    return items;
  }

}
