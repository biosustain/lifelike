import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from '../../file-browser/services/object-type.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';
import { RankedItem } from '../../shared/schemas/common';
import { ObjectCreationService } from '../../file-browser/services/object-creation.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SearchType } from '../../search/shared';
import { EnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentTableService } from '../services/enrichment-table.service';
import { finalize, map, mergeMap, take, tap } from 'rxjs/operators';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { TableCSVExporter } from '../../shared/utils/tables/table-csv-exporter';
import { EnrichmentTable } from '../models/enrichment-table';
import { EnrichmentTablePreviewComponent } from '../components/table/enrichment-table-preview.component';
import {
  EnrichmentTableEditDialogComponent,
  EnrichmentTableEditDialogValue,
} from '../components/table/dialog/enrichment-table-edit-dialog.component';
import { ObjectContentSource, ObjectCreateRequest } from '../../file-browser/schema';
import { AnnotationsService } from '../../file-browser/services/annotations.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { openModal } from '../../shared/utils/modals';

export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.lifelike.document/enrichment-table';

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly filesystemService: FilesystemService,
              protected readonly annotationsService: AnnotationsService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly objectCreationService: ObjectCreationService,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly injector: Injector,
              protected readonly worksheetService: EnrichmentTableService) {
    super(abstractObjectTypeProviderHelper);
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
      mergeMap(blob => new EnrichmentDocument(this.worksheetService).loadResult(blob, object.hashId)),
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
          object.filename = '';
          object.mimeType = ENRICHMENT_TABLE_MIMETYPE;
          object.parent = options.parent;

          const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
          dialogRef.componentInstance.title = 'New Enrichment Table Parameters';
          dialogRef.componentInstance.object = object;
          dialogRef.componentInstance.document = new EnrichmentDocument(this.worksheetViewerService);

          return dialogRef.result.then((value: EnrichmentTableEditDialogValue) => {
            const progressDialogRef = this.progressDialog.display({
              title: 'Enrichment Table Creating',
              progressObservable: new BehaviorSubject<Progress>(new Progress({
                status: 'Generating data for enrichment table...',
              })),
            });

            const document = value.document;

            return document.refreshData().pipe(
              mergeMap(newDocument => newDocument.save()),
              tap(() => progressDialogRef.close()),
              mergeMap(blob =>
                from(this.objectCreationService.executePutWithProgressDialog({
                  ...(value.request as Omit<ObjectCreateRequest, keyof ObjectContentSource>),
                  contentValue: blob,
                }, {
                  organism: {
                    organism_name: document.organism,
                    synonym: document.organism,
                    tax_id: document.taxID}}))),
              finalize(() => progressDialogRef.close()),
            ).toPromise();
          });
        },
      },
    }];
  }

  openEditDialog(target: FilesystemObject, options: {} = {}): Promise<any> {
    const progressDialogRef = this.progressDialog.display({
      title: 'Edit Enrichment Table',
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Getting table information for editing...',
      })),
    });

    return this.filesystemService.getContent(target.hashId).pipe(
      mergeMap((blob: Blob) => new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, target.hashId)),
      tap(() => progressDialogRef.close()),
      mergeMap(document => {
        const dialogRef = openModal(this.modalService, EnrichmentTableEditDialogComponent);
        dialogRef.componentInstance.object = target;
        dialogRef.componentInstance.document = document;
        dialogRef.componentInstance.fileId = target.hashId;
        dialogRef.componentInstance.accept = (value: EnrichmentTableEditDialogValue) => {
          const progressDialog2Ref = this.progressDialog.display({
            title: 'Working...',
            progressObservable: new BehaviorSubject<Progress>(new Progress({
              status: 'Updating enrichment table...',
            })),
          });

          return value.document.refreshData().pipe(
            mergeMap(doc => doc.save()),
            mergeMap(newBlob => this.filesystemService.save([target.hashId], {
              contentValue: newBlob,
              ...value.request,
            })),
            map(() => value),
            // Errors are lost below with the catch() so we need to handle errors here too
            this.errorHandler.create(),
            finalize(() => progressDialog2Ref.close()),
          ).toPromise();
        };

        return from(dialogRef.result.catch(() => {
          // A cancel should not be converted to an error
        }));
      }),
      take(1),
      this.errorHandler.create(),
      finalize(() => progressDialogRef.close()),
    ).toPromise();
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({
        id: ENRICHMENT_TABLE_MIMETYPE,
        shorthand: 'enrichment-table',
        name: 'Enrichment Tables',
      }),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'CSV',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          mergeMap(blob => new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, object.hashId)),
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
