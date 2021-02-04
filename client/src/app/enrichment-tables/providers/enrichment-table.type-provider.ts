import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { EnrichmentTableEditDialogComponent } from '../components/enrichment-table-edit-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SearchType } from '../../search/shared';
import { EnrichmentData } from '../models/enrichment-document';

export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table';

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly objectCreationService: ObjectCreationService,
              protected readonly modalService: NgbModal) {
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
          const defaultDomains = [
            'Regulon',
            'UniProt',
            'String',
            'GO',
            'Biocyc',
          ];

          const object = new FilesystemObject();
          object.filename = 'Untitled Enrichment Table';
          object.mimeType = ENRICHMENT_TABLE_MIMETYPE;
          object.parent = options.parent;

          const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
          dialogRef.componentInstance.title = 'New Enrichment Table Parameters';
          dialogRef.componentInstance.submitButtonLabel = 'Next';
          dialogRef.componentInstance.object = object;
          dialogRef.componentInstance.data = {
            data: '///' + defaultDomains.join(','),
          } as EnrichmentData;

          return dialogRef.result.then((result: EnrichmentData) => {
            return this.objectCreationService.openCreateDialog(object, {
              title: 'Name the Enrichment Table',
              request: {
                contentValue: new Blob([JSON.stringify(result)]),
              },
              ...(options.createDialog || {}),
            });
          });
        },
      },
    }];
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: ENRICHMENT_TABLE_MIMETYPE, name: 'Enrichment Tables'}),
    ];
  }

}
