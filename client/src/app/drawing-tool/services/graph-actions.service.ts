import { Injectable } from '@angular/core';

import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import { IMAGE_DEFAULT_SIZE } from 'app/shared/constants';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { GraphAction } from 'app/graph-viewer/actions/actions';

import { MapImageProviderService } from './map-image-provider.service';
import { extractGraphEntityActions } from '../utils/data';
import { IMAGE_TOKEN, ImageTransferData } from '../providers/image-entity-data.provider';

@Injectable()
export class GraphActionsService {

  constructor(readonly mapImageProviderService: MapImageProviderService,
              readonly filesystemService: FilesystemService) { }

  // TODO: Change hoverPosition into point after merge with canvas-refactor PR
  async fromDataTransferItems(items: DataTransferData<any>[], hoverPosition: {x: number, y: number}): Promise<GraphAction[]> {
    const actions = extractGraphEntityActions(items, hoverPosition);
    const imageItems = items.filter(item => item.token === IMAGE_TOKEN);
    for (const item of imageItems) {
      const {node, hash} = item.data as ImageTransferData;
      // This takes a split second, but we might want to consider having a progress bar here!
      this.filesystemService.getContent(hash).subscribe(async (blob) => {
        const imageId = makeid();
        await this.mapImageProviderService.doInitialProcessing(imageId, new File([blob], imageId))
          .subscribe(dimensions => {
            // Scale smaller side up to 300 px
            const ratio = IMAGE_DEFAULT_SIZE / Math.min(dimensions.width, dimensions.height);
            actions.push(new NodeCreation(`Insert image`, {
              ...node,
              hash: uuidv4(),
              image_id: imageId,
              label: 'image',
              data: {
                x: hoverPosition.x,
                y: hoverPosition.y,
                width: dimensions.width * ratio,
                height: dimensions.height * ratio,
              },
            }, true));
          });
      });
    }
    return actions;
  }
}
