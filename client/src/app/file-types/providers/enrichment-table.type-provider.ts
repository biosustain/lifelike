import { ComponentFactory, ComponentFactoryResolver, Injectable, Injector } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { finalize, map, mergeMap, mergeScan, switchMap, take, tap } from 'rxjs/operators';

import {
  EnrichmentTableEditDialogComponent,
  EnrichmentTableEditDialogValue,
} from 'app/enrichment-table/components/dialog/enrichment-table-edit-dialog.component';
import { EnrichmentTablePreviewComponent } from 'app/enrichment-table/components/enrichment-table-preview.component';
import { EnrichmentDocument } from 'app/enrichment-table/models/enrichment-document';
import { EnrichmentTable } from 'app/enrichment-table/models/enrichment-table';
import { EnrichmentTableService } from 'app/enrichment-table/services/enrichment-table.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  BulkObjectUpdateRequest,
  ObjectContentSource,
  ObjectCreateRequest,
} from 'app/file-browser/schema';
import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions,
} from 'app/file-types/providers/base-object.type-provider';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { SearchType } from 'app/search/shared';
import { RankedItem } from 'app/shared/schemas/common';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/modules/dialog/services/progress-dialog.service';
import { openModal } from 'app/shared/utils/modals';
import { TableCSVExporter } from 'app/shared/utils/tables/table-csv-exporter';

export const ENRICHMENT_TABLE_MIMETYPE = 'vnd.***ARANGO_DB_NAME***.document/enrichment-table';

const BIOC_ID_COLUMN_INDEX = 2;

@Injectable()
export class EnrichmentTableTypeProvider extends AbstractObjectTypeProvider {
  constructor(
    abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
    protected readonly modalService: NgbModal,
    protected readonly progressDialog: ProgressDialog,
    protected readonly filesystemService: FilesystemService,
    protected readonly annotationsService: AnnotationsService,
    protected readonly errorHandler: ErrorHandler,
    protected readonly objectCreationService: ObjectCreationService,
    protected readonly worksheetViewerService: EnrichmentTableService,
    protected readonly componentFactoryResolver: ComponentFactoryResolver,
    protected readonly injector: Injector,
    protected readonly worksheetService: EnrichmentTableService
  ) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === ENRICHMENT_TABLE_MIMETYPE;
  }

  createPreviewComponent(
    object: FilesystemObject,
    contentValue$: Observable<Blob>,
    options?: PreviewOptions
  ) {
    const factory: ComponentFactory<EnrichmentTablePreviewComponent> =
      this.componentFactoryResolver.resolveComponentFactory(EnrichmentTablePreviewComponent);
    const componentRef = factory.create(this.injector);
    const instance: EnrichmentTablePreviewComponent = componentRef.instance;
    return contentValue$.pipe(
      mergeMap((blob) =>
        new EnrichmentDocument(this.worksheetService).loadResult(blob, object.hashId)
      ),
      map((document) => {
        instance.document = document;
        return componentRef;
      })
    );
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [
      {
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
            dialogRef.componentInstance.document = new EnrichmentDocument(
              this.worksheetViewerService
            );

            return dialogRef.result.then((value: EnrichmentTableEditDialogValue) => {
              const progressDialogRef = this.progressDialog.display({
                title: 'Enrichment Table Creating',
                progressObservables: [
                  new BehaviorSubject<Progress>(
                    new Progress({
                      status: 'Generating data for enrichment table...',
                    })
                  ),
                ],
              });

              const document = value.document;

              document.setParameters(value.documentChanges);

              return document
                .refreshData()
                .pipe(
                  mergeMap((newDocument) => newDocument.save()),
                  tap(() => progressDialogRef.close()),
                  map(
                    (blob) =>
                      ({
                        ...(value.createRequest as Omit<
                          ObjectCreateRequest,
                          keyof ObjectContentSource
                        >),
                        contentValue: blob,
                      } as ObjectCreateRequest)
                  ),
                  switchMap((request) =>
                    this.objectCreationService.executePutWithProgressDialog(
                      [request],
                      [
                        {
                          organism: {
                            organism_name: document.organism,
                            synonym: document.organism,
                            tax_id: document.taxID,
                          },
                        },
                      ]
                    )
                  ),
                  map((resultMapping) => resultMapping.values().next().value.creation.result),
                  finalize(() => progressDialogRef.close())
                )
                .toPromise();
            });
          },
        },
      },
    ];
  }

  openEditDialog(
    target: FilesystemObject,
    options: {} = {}
  ): Promise<EnrichmentTableEditDialogValue> {
    const progressDialogRef = this.progressDialog.display({
      title: 'Edit Enrichment Table',
      progressObservables: [
        new BehaviorSubject<Progress>(
          new Progress({
            status: 'Getting table information for editing...',
          })
        ),
      ],
    });

    return this.filesystemService
      .getContent(target.hashId)
      .pipe(
        mergeScan(
          (document, blob: Blob) => document.loadResult(blob, target.hashId),
          new EnrichmentDocument(this.worksheetViewerService)
        ),
        tap(() => progressDialogRef.close()),
        mergeMap((document) => {
          const dialogRef = openModal(this.modalService, EnrichmentTableEditDialogComponent);
          dialogRef.componentInstance.object = target;
          dialogRef.componentInstance.document = document;
          dialogRef.componentInstance.fileId = target.hashId;
          dialogRef.componentInstance.accept = (value: EnrichmentTableEditDialogValue) => {
            const progressDialog2Ref = this.progressDialog.display({
              title: 'Working...',
              progressObservables: [
                new BehaviorSubject<Progress>(
                  new Progress({
                    status: 'Updating enrichment table...',
                  })
                ),
              ],
            });

            value.document.setParameters(value.documentChanges);

            const changes$: Observable<Partial<BulkObjectUpdateRequest>> = value.document
              .markForRegeneration
              ? value.document.updateParameters().pipe(
                  map((blob) => ({
                    contentValue: blob,
                    ...value.patchRequest,
                  })),
                  take(1)
                )
              : of(value.patchRequest);

            // old files can have outdated or corrupted data/schema
            // so instead of refreshing, update and save
            // this will trigger recreating the enrichment JSON
            return changes$
              .pipe(
                mergeMap((changes) =>
                  this.filesystemService.save([target.hashId], changes, { [target.hashId]: target })
                ),
                mergeMap((o) => document.refreshData()),
                map(() => value),
                // Errors are lost below with the catch() so we need to handle errors here too
                this.errorHandler.create(),
                finalize(() => {
                  progressDialog2Ref.close();
                })
              )
              .toPromise();
          };

          return from(
            dialogRef.result.catch((e) => {
              // A cancel should not be converted to an error
            })
          );
        }),
        take(1),
        this.errorHandler.create(),
        finalize(() => progressDialogRef.close())
      )
      .toPromise();
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

  addBioCycIdColumn(document: EnrichmentDocument, table: EnrichmentTable): void {
    const biocycInfo = document.result?.domainInfo?.BioCyc;
    const biocycLabels = biocycInfo?.labels;
    if (biocycLabels) {
      table.tableHeader[0].splice(BIOC_ID_COLUMN_INDEX, 0, {
        name: 'BioCyc ID',
        span: '' + biocycLabels.length,
      });
      const tableHeaderLine2 = table.tableHeader[1];
      if (tableHeaderLine2) {
        if (biocycLabels.length > 1) {
          tableHeaderLine2.splice(
            BIOC_ID_COLUMN_INDEX,
            0,
            ...biocycLabels.map((name) => ({ name, span: '1' }))
          );
        } else {
          tableHeaderLine2.splice(BIOC_ID_COLUMN_INDEX, 0, { name: '', span: '1' });
        }
      }
      document.result.genes.forEach((gene, index) =>
        table.tableCells[index].splice(
          BIOC_ID_COLUMN_INDEX,
          0,
          ...biocycLabels.map((label) => {
            const geneDomainResult = gene?.domains?.BioCyc?.[label];
            if (geneDomainResult) {
              const biocycId = /[\?&]id=([^&#]*)/.exec(geneDomainResult.link)?.[1] ?? '';
              return { text: biocycId };
            } else {
              return { text: '' };
            }
          })
        )
      );
    }
  }

  prepareTableForRadiateAnalysis(table: EnrichmentTable) {
    table.tableHeader = [
      [
        { name: 'value', span: '1' },
        { name: 'biocyc_id', span: '1' },
        { name: 'gene_name', span: '1' },
        { name: 'ncbi_gene_full_name', span: '1' },
      ],
    ];
    // Remove all rows where there was no match, and mutate each row to only include the required columns.
    table.tableCells = table.tableCells.filter((row) => {
      const matched = row[3].text !== 'No match found.';

      if (matched) {
        row.shift();
        row.splice(4);
      }

      return matched;
    });
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([
      {
        name: 'CSV',
        export: () =>
          this.filesystemService.getContent(object.hashId).pipe(
            mergeMap((blob) =>
              new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, object.hashId)
            ),
            mergeMap((document) =>
              new EnrichmentTable({
                usePlainText: true,
              })
                .load(document)
                .pipe(tap((table) => this.addBioCycIdColumn(document, table)))
            ),
            mergeMap((table) =>
              new TableCSVExporter().generate(table.tableHeader, table.tableCells)
            ),
            map((blob) => {
              return new File([blob], object.filename + '.csv');
            })
          ),
      },
      {
        name: 'Genes for Graph Analysis CSV',
        export: () =>
          this.filesystemService.getContent(object.hashId).pipe(
            mergeMap((blob) =>
              new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, object.hashId)
            ),
            mergeMap((document) =>
              new EnrichmentTable({
                usePlainText: true,
              })
                .load(document)
                .pipe(
                  tap((table) => this.addBioCycIdColumn(document, table)),
                  tap((table) => this.prepareTableForRadiateAnalysis(table))
                )
            ),
            mergeMap((table) =>
              new TableCSVExporter().generate(table.tableHeader, table.tableCells)
            ),
            map((blob) => {
              return new File([blob], object.filename + '_for_graph_analysis.csv');
            })
          ),
      },
      {
        name: 'Lifelike Enrichment Table File',
        export: () => {
          return this.filesystemService.getContent(object.hashId).pipe(
            map((blob) => {
              return new File([blob], object.filename + '.llenrichmenttable.json');
            })
          );
        },
      },
    ]);
  }
}
