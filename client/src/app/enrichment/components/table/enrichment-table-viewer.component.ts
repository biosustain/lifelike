import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { map, mergeMap, shareReplay, take, tap } from 'rxjs/operators';

import { isNullOrUndefined } from 'util';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { ObjectUpdateRequest } from 'app/file-browser/schema';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { AsyncElementFind } from 'app/shared/utils/find/async-element-find';

import { EnrichmentDocument } from '../../models/enrichment-document';
import { EnrichmentTable } from '../../models/enrichment-table';
import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableEditDialogComponent, EnrichmentTableEditDialogValue } from './dialog/enrichment-table-edit-dialog.component';

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy, AfterViewInit {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  @ViewChild('tableScroll', {static: false}) tableScrollRef: ElementRef;
  @ViewChildren('findTarget') findTarget: QueryList<ElementRef>;

  fileId: string;
  object$: Observable<FilesystemObject> = new Subject();
  document$: Observable<EnrichmentDocument> = new Subject();
  table$: Observable<EnrichmentTable> = new Subject();
  scrollTopAmount: number;
  findController = new AsyncElementFind();
  findTargetChangesSub: Subscription;
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
    this.findController.query = this.parseQueryFromUrl(this.route.snapshot.fragment);
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

  ngAfterViewInit() {
    this.findTargetChangesSub = this.findTarget.changes.subscribe({
      next: () => {
        if (this.findTarget.first) {
          this.findController.target = this.findTarget.first.nativeElement.getElementsByTagName('tbody')[0];
          // This may seem like an anti-pattern -- and it probably is -- but there is seemingingly no other way around Angular's
          // `ExpressionChangedAfterItHasBeenCheckedError` here. Even Angular seems to think so, as they use this exact pattern in their
          // own example: https://angular.io/api/core/ViewChildren#another-example
          setTimeout(() => {
            // TODO: Need to have a brief background color animation when the table is loaded and the first match is rendered. (?)
            // Actually not sure if this the desired behavior.
            this.findController.nextOrStart();
          }, 0);
        } else {
          this.findController.target = null;
        }
      }
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.tickAnimationFrameId);
    if (!isNullOrUndefined(this.findTargetChangesSub)) {
      this.findTargetChangesSub.unsubscribe();
    }
  }

  parseQueryFromUrl(fragment: string): string {
    const params = new URLSearchParams(fragment);
    return params.get('query') || '';
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
