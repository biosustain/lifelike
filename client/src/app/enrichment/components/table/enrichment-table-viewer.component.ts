import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { mergeMap, shareReplay, take, tap } from 'rxjs/operators';
import { ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ObjectCreationService } from '../../../file-browser/services/object-creation.service';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { EnrichmentDocument } from '../../models/enrichment-document';
import { EnrichmentTable } from '../../models/enrichment-table';
import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { FilesystemService } from '../../../file-browser/services/filesystem.service';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { ObjectVersion } from '../../../file-browser/models/object-version';
import { EnrichmentVisualisationEditDialogComponent } from '../visualisation/dialog/enrichment-visualisation-edit-dialog.component';
import { ENRICHMENT_VISUALISATION_MIMETYPE } from '../visualisation/table/enrichment-table-viewer.component';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableEditDialogComponent } from './dialog/enrichment-table-edit-dialog.component';

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  fileId: string;
  object$: Observable<FilesystemObject> = new Subject();
  contentValue$: Observable<Blob> = new Subject();
  document$: Observable<EnrichmentDocument> = new Subject();
  table$: Observable<EnrichmentTable> = new Subject();
  scrollTopAmount: number;

  unsavedChanges$ = new BehaviorSubject<boolean>(false);

  constructor(protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly objectCreationService: ObjectCreationService,
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
    this.document$ = this.filesystemService.getContent(this.fileId).pipe(
      mergeMap((blob: Blob) => new EnrichmentDocument(this.worksheetViewerService).load(blob)),
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

  restore(version: ObjectVersion) {
    this.document$ = new EnrichmentDocument(this.worksheetViewerService).load(version.contentValue).pipe(
      tap(() => this.unsavedChanges$.next(true)),
      shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap(document => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Restore enrichment table'}),
      shareReplay(),
    );
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

  createVisualisation() {
    const dialogRef = this.modalService.open(EnrichmentVisualisationEditDialogComponent);
    dialogRef.componentInstance.title = 'New Enrichment Visualisation Parameters';
    dialogRef.componentInstance.submitButtonLabel = 'Next';
    const object = new FilesystemObject();
    object.filename = 'Untitled Enrichment Visualisation';
    object.mimeType = ENRICHMENT_VISUALISATION_MIMETYPE;
    object.parent = this.object$.parent;
    dialogRef.componentInstance.object = object;
    dialogRef.componentInstance.data = {
      // domains: this.domains,
      // genes: this.importGenes,
      // organism: this.organism
    };

    return dialogRef.result.then((parameters) => {
      return this.objectCreationService.openCreateDialog(object, {
        title: 'Name the Enrichment Visualisation',
        request: {
          contentValue: new Blob([JSON.stringify({parameters, cachedResults: {}})]),
        }
      });
    });
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
