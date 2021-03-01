import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { Injectable } from '@angular/core';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  EnrichmentVisualisationEditDialogComponent
} from '../components/visualisation/dialog/enrichment-visualisation-edit-dialog.component';

export const ENRICHMENT_VISUALISATION_MIMETYPE = 'vnd.lifelike.document/enrichment-visualisation';

@Injectable()
export class EnrichmentVisualisationTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly objectCreationService: ObjectCreationService,
              protected readonly modalService: NgbModal) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === ENRICHMENT_VISUALISATION_MIMETYPE;
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 1,
      item: {
        label: 'Enrichment Visualisation',
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
          object.filename = 'Untitled Enrichment Visualisation';
          object.mimeType = ENRICHMENT_VISUALISATION_MIMETYPE;
          object.parent = options.parent;

          const dialogRef = this.modalService.open(EnrichmentVisualisationEditDialogComponent);
          dialogRef.componentInstance.title = 'New Enrichment Visualisation Parameters';
          dialogRef.componentInstance.submitButtonLabel = 'Next';
          dialogRef.componentInstance.object = object;
          dialogRef.componentInstance.data = {
            domains: defaultDomains
          };

          return dialogRef.result.then((parameters) => {
            return this.objectCreationService.openCreateDialog(object, {
              title: 'Name the Enrichment Visualisation',
              request: {
                contentValue: new Blob([JSON.stringify({parameters, cachedResults: {}})]),
              },
              ...(options.createDialog || {}),
            });
          });
        },
      },
    }];
  }
}
