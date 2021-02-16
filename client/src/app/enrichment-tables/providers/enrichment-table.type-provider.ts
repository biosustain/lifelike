import {
  AbstractObjectTypeProvider,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { EnrichmentTableEditDialogComponent } from '../components/enrichment-table-edit-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SearchType } from '../../search/shared';
import { EnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentTableService } from '../services/enrichment-table.service';
import { finalize, map, mergeMap } from 'rxjs/operators';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { EnrichmentTablePreviewComponent } from '../components/enrichment-table-preview.component';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { TableCSVExporter } from '../../shared/utils/tables/table-csv-exporter';
import { EnrichmentTable } from '../models/enrichment-table';

export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table';
export const ENRICHMENT_TABLE_SHORTHAND = 'enrichment-table';

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {

  constructor(protected readonly objectCreationService: ObjectCreationService,
              protected readonly modalService: NgbModal,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly filesystemService: FilesystemService,
              protected readonly worksheetService: EnrichmentTableService) {
    super();
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === ENRICHMENT_TABLE_MIMETYPE;
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions) {
    const factory: ComponentFactory<EnrichmentTablePreviewComponent> =
      this.componentFactoryResolver.resolveComponentFactory(EnrichmentTablePreviewComponent);
    const componentRef = factory.create(this.injector);
    const instance: EnrichmentTablePreviewComponent = componentRef.instance;
    return contentValue$.pipe(
      mergeMap(blob => new EnrichmentDocument(this.worksheetService).load(blob)),
      map(document => {
        instance.document = document;
        return componentRef;
      }),
    );
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
      Object.freeze({id: ENRICHMENT_TABLE_MIMETYPE, shorthand: 'enrichment-table', name: 'Enrichment Tables'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'CSV',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          mergeMap(blob => new EnrichmentDocument(this.worksheetViewerService).load(blob)),
          mergeMap(document => new EnrichmentTable().load(document)),
          mergeMap(table => new TableCSVExporter().generate(table.tableHeader, table.tableCells)),
          map(blob => {
            return new File([blob], object.filename + '.csv');
          }),
        );
      },
    }, {
      name: 'Lifelike Enrichment Table File',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename + '.llenrichmenttable.json');
          }),
        );
      },
    }]);
  }

}
