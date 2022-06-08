import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { defaultIfEmpty, map, mergeMap, switchMap, take, tap } from 'rxjs/operators';

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
        label: 'image',
        data: {
          x: hoverPosition.x,
          y: hoverPosition.y,
          width: dimensions.width * ratio,
          height: dimensions.height * ratio,
        },
      }, true));
    }),
      tap(action => actions.push(action)),
    ).toPromise();

    return actions;
  }
}
