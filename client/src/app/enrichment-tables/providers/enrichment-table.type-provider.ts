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
import { EnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentTableService } from '../services/enrichment-table.service';
import { finalize, map, mergeMap } from 'rxjs/operators';
import { BehaviorSubject, from } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';

export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.lifelike.document/enrichment-table';

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly objectCreationService: ObjectCreationService,
              protected readonly modalService: NgbModal,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly progressDialog: ProgressDialog) {
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
        create: (options?: CreateActionOptions): Promise<FilesystemObject> => {
          const object = new FilesystemObject();
          object.filename = 'Untitled Enrichment Table';
          object.mimeType = ENRICHMENT_TABLE_MIMETYPE;
          object.parent = options.parent;

          const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
          dialogRef.componentInstance.title = 'New Enrichment Table Parameters';
          dialogRef.componentInstance.submitButtonLabel = 'Next';
          dialogRef.componentInstance.document = new EnrichmentDocument(this.worksheetViewerService);

          return dialogRef.result.then((result: EnrichmentDocument) => {
            const progressDialogRef = this.progressDialog.display({
              title: 'Enrichment Table Creating',
              progressObservable: new BehaviorSubject<Progress>(new Progress({
                status: 'Generating data for enrichment table...',
              })),
            });

            return result.refreshData().pipe(
              mergeMap(document => document.save()),
              mergeMap(blob =>
                from(this.objectCreationService.openCreateDialog(object, {
                  title: 'Name the Enrichment Table',
                  request: {
                    contentValue: blob,
                  },
                  ...(options.createDialog || {}),
                }))),
              finalize(() => progressDialogRef.close()),
            ).toPromise();
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
