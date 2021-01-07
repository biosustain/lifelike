import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
} from '../../file-browser/services/object-type.service';
import {
  ENRICHMENT_TABLE_MIMETYPE,
  FilesystemObject,
} from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly objectCreationService: ObjectCreationService) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === ENRICHMENT_TABLE_MIMETYPE;
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 1,
      item: {
        label: 'Enrichment Table',
        openSuggested: true,
        create: (options?: CreateActionOptions) => {
          const object = new FilesystemObject();
          object.filename = 'Untitled Enrichment Table';
          object.mimeType = ENRICHMENT_TABLE_MIMETYPE;
          object.parent = options.parent;
          return this.objectCreationService.openCreateDialog(object, {
            title: 'New Enrichment Table',
            request: {
              contentValue: new Blob([JSON.stringify({})]),
            },
            ...(options.createDialog || {}),
          });
        },
      },
    }];
  }

}
