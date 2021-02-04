import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { finalize, map, mergeMap, shareReplay, take, tap } from 'rxjs/operators';
import { ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { EnrichmentTableService } from '../services/enrichment-table.service';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { EnrichmentDocument } from '../models/enrichment-document';
import { EnrichmentTable } from '../models/enrichment-table';
import { EnrichmentTableEditDialogComponent } from './enrichment-table-edit-dialog.component';
import { EnrichmentTableOrderDialogComponent } from './enrichment-table-order-dialog.component';
import { TableCSVExporter } from '../../shared/utils/tables/table-csv-exporter';
import { openDownloadForBlob } from '../../shared/utils/files';
import { Progress } from '../../interfaces/common-dialog.interface';

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  fileId: string;
  object$: Observable<FilesystemObject> = new Subject();
  document$: Observable<EnrichmentDocument> = new Subject();
  table$: Observable<EnrichmentTable> = new Subject();
  scrollTopAmount: number;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  constructor(protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly changeDetectorRef: ChangeDetectorRef) {
    this.fileId = this.route.snapshot.params.file_id || '';
  }

  ngOnInit() {
    this.object$ = this.filesystemService.get(this.fileId).pipe(
      tap(object => {
        this.emitModuleProperties();
      }),
      shareReplay(),
    );
    this.document$ = this.object$.pipe(
      mergeMap((object: FilesystemObject) => {
        return object.contentValue$.pipe(
          mergeMap((blob: Blob) => new EnrichmentDocument(this.worksheetViewerService).load(blob)),
        );
      }),
      shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap(document => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Load enrichment table'}),
      shareReplay(),
    );
  }

  scrollTop() {
    this.scrollTopAmount = 0;
  }

  onTableScroll(e) {
    this.scrollTopAmount = e.target.scrollTop;
  }

  refreshData(assumeChanged = false) {
    this.table$ = combineLatest(
      this.document$,
      this.table$,
    ).pipe(
      take(1),
      mergeMap(([document, table]) => document.refreshData().pipe(
        mergeMap(() => new EnrichmentTable().load(document)),
        tap(newTable => {
          if (assumeChanged) {
            this.unsavedChanges$.next(true);
          } else if (!table.equals(newTable)) {
            this.unsavedChanges$.next(true);
            this.snackBar.open(
              `Data refreshed.`,
              'Close',
              {duration: 5000},
            );
          } else {
            this.snackBar.open(
              `Data refreshed but there were no changes.`,
              'Close',
              {duration: 5000},
            );
          }
        }),
      )),
      shareReplay(),
      this.errorHandler.create({label: 'Load enrichment table'}),
    );
  }

  save() {
    combineLatest(
      this.object$,
      this.document$.pipe(
        mergeMap(document => document.save()),
      ),
    ).pipe(
      take(1),
      mergeMap(([object, blob]) =>
        this.filesystemService.save([object.hashId], {
          contentValue: blob,
        })),
      tap(() => this.unsavedChanges$.next(false)),
      this.errorHandler.create({label: 'Save enrichment table'}),
    ).subscribe(() => {
      this.snackBar.open(
        `Enrichment table saved.`,
        'Close',
        {duration: 5000},
      );
    });
  }

  /**
   * Load all data, convert to CSV format and provide download.
   */
  downloadAsCSV() {
    const progressDialogRef = this.progressDialog.display({
      title: 'Generating Export',
      progressObservable: new BehaviorSubject<Progress>(new Progress({
        status: 'Generating CSV...',
      })),
    });

    combineLatest(
      this.object$,
      this.table$.pipe(
        mergeMap(table => new TableCSVExporter().generate(table.tableHeader, table.tableCells)),
      ),
    ).pipe(
      take(1),
      map(([object, blob]) => {
        openDownloadForBlob(blob, object.filename + '.csv');
        return true;
      }),
      this.errorHandler.create({label: 'Export enrichment table'}),
      finalize(() => progressDialogRef.close()),
    ).subscribe();
  }

  /**
   * Opens EnrichmentTableOrderDialog that gives new column order.
   */
  openOrderDialog() {
    this.document$.pipe(
      take(1),
    ).subscribe(document => {
      const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
      dialogRef.componentInstance.domains = [...document.domains];
      return dialogRef.result.then((result) => {
        if (document.domains !== result) {
          document.domains = result;
          this.unsavedChanges$.next(true);
          this.table$ = new EnrichmentTable().load(document).pipe(
            this.errorHandler.create({label: 'Re-order enrichment table'}),
            shareReplay(),
          );
        }
      }, () => {
      });
    });
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentTableEditDialog(document: EnrichmentDocument): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.document = document;
    return dialogRef.result.then((result: Document) => {
      this.unsavedChanges$.next(true);
      this.refreshData(true);
    }, () => {
    });
  }

  emitModuleProperties() {
    this.object$.pipe(
      take(1),
    ).subscribe(object => {
      this.modulePropertiesChange.emit({
        title: object ? object.filename : 'Enrichment Table',
        fontAwesomeIcon: 'table',
      });
    });
  }

  dragStarted(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);
  }

  objectUpdate() {
    this.emitModuleProperties();
    this.changeDetectorRef.detectChanges();
  }
}
