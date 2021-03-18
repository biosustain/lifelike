import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subject } from 'rxjs';
import { map, mergeMap, shareReplay, take, tap } from 'rxjs/operators';
import { ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { EnrichmentDocument } from '../../models/enrichment-document';
import { EnrichmentTable } from '../../models/enrichment-table';
import { ObjectUpdateRequest } from '../../../file-browser/schema';
import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { FilesystemService } from '../../../file-browser/services/filesystem.service';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';
import { ObjectVersion } from '../../../file-browser/models/object-version';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableEditDialogComponent, EnrichmentTableEditDialogValue } from './dialog/enrichment-table-edit-dialog.component';
import { AsyncElementFind } from '../../../shared/utils/find/async-element-find';

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy, AfterViewChecked {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  @ViewChild('tableScroll', {static: false}) tableScrollRef: ElementRef;
  @ViewChild('findTarget', {static: false}) findTargetRef: ElementRef;

  fileId: string;
  object$: Observable<FilesystemObject> = new Subject();
  document$: Observable<EnrichmentDocument> = new Subject();
  table$: Observable<EnrichmentTable> = new Subject();
  scrollTopAmount: number;
  findController = new AsyncElementFind();
  private tickAnimationFrameId: number;

  /**
   * Keeps tracks of changes so they aren't saved to the server until you hit 'Save'. However,
   * due to the addition of annotations to enrichment tables, this feature has been broken.
   */
  queuedChanges$ = new BehaviorSubject<ObjectUpdateRequest | undefined>(null);

  constructor(protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly changeDetectorRef: ChangeDetectorRef,
              protected readonly elementRef: ElementRef) {
    this.fileId = this.route.snapshot.params.file_id || '';
  }

  ngOnInit() {
    this.object$ = this.filesystemService.get(this.fileId).pipe(
      tap(() => {
        this.emitModuleProperties();
      }),
      shareReplay(),
    );
    this.document$ = this.filesystemService.getContent(this.fileId).pipe(
      mergeMap((blob: Blob) => new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, this.fileId)),
      shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap(document => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Load enrichment table'}),
      shareReplay(),
    );
    this.tickAnimationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  ngAfterViewChecked() {
    if (this.tableScrollRef && this.findTargetRef) {
      // Set the find controller target to the table body, otherwise we'll also be searching the headers. At first glance this might make
      // sense, but the sticky headers make rendering the highlights kind of funky, and probably the user doesn't care about them anyway.
      this.findController.target = this.findTargetRef.nativeElement.getElementsByTagName('tbody')[0];
    } else {
      this.findController.target = null;
    }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.tickAnimationFrameId);
  }

  tick() {
    this.findController.tick();
    this.tickAnimationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  scrollTop() {
    this.scrollTopAmount = 0;
  }

  onTableScroll(e) {
    this.scrollTopAmount = e.target.scrollTop;
  }

  restore(version: ObjectVersion) {
    this.document$ = new EnrichmentDocument(this.worksheetViewerService).loadResult(version.contentValue, this.fileId).pipe(
      tap(() => this.queuedChanges$.next(this.queuedChanges$.value || {})),
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

  refreshData() {
    this.table$ = combineLatest(
      this.document$,
      this.table$,
    ).pipe(
      take(1),
      mergeMap(([document, table]) => document.refreshData().pipe(
        mergeMap(() => new EnrichmentTable().load(document)),
        tap(newTable => {
          this.snackBar.open(
            `Data refreshed.`,
            'Close',
            {duration: 5000},
          );
        }),
        mergeMap(newTable => {
          this.queuedChanges$.next(this.queuedChanges$.value || {});
          return this.save().pipe(
            map(() => newTable),
          );
        }),
      )),
      shareReplay(),
      this.errorHandler.create({label: 'Load enrichment table'}),
    );
  }

  save() {
    const observable = combineLatest(
      this.object$,
      this.document$.pipe(
        mergeMap(document => document.save()),
      ),
    ).pipe(
      take(1),
      mergeMap(([object, blob]) =>
        this.filesystemService.save([object.hashId], {
          contentValue: blob,
          ...this.queuedChanges$.value,
        })),
      tap(() => this.queuedChanges$.next(null)),
      this.errorHandler.create({label: 'Save enrichment table'}),
      shareReplay(),
    );

    observable.subscribe(() => {
      this.snackBar.open(
        `Enrichment table saved.`,
        'Close',
        {duration: 5000},
      );
    });

    return observable;
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
          this.queuedChanges$.next(this.queuedChanges$.value || {});
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
  openEnrichmentTableEditDialog(object: FilesystemObject, document: EnrichmentDocument): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.promptObject = false;
    dialogRef.componentInstance.object = object;
    dialogRef.componentInstance.document = document;
    dialogRef.componentInstance.fileId = this.fileId;
    return dialogRef.result.then((result: EnrichmentTableEditDialogValue) => {
      this.queuedChanges$.next({
        ...(this.queuedChanges$.value || {}),
      });
      this.refreshData();
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
