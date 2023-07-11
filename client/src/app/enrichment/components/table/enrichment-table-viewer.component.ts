import { Component, OnDestroy, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  merge,
  Observable,
  ReplaySubject,
  Subject,
} from 'rxjs';
import {
  filter,
  finalize,
  map,
  mergeMap,
  mergeScan,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { ObjectUpdateRequest } from 'app/file-browser/schema';
import { ModuleAwareComponent } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { AsyncElementFind } from 'app/shared/utils/find/async-element-find';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ModuleContext } from 'app/shared/services/module-context.service';

import { EnrichmentDocument } from '../../models/enrichment-document';
import { EnrichmentTable } from '../../models/enrichment-table';
import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import {
  EnrichmentTableEditDialogComponent,
  EnrichmentTableEditDialogValue,
} from './dialog/enrichment-table-edit-dialog.component';
import { EnrichmentService } from '../../services/enrichment.service';
import { FindControllerService } from '../../services/find-controller.service';
import { EnrichmentTableComponent } from './enrichment-table.component';

// TODO: Is there an existing interface we could use here?
interface AnnotationData {
  id: string;
  text: string;
  color: string;
}

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
  providers: [EnrichmentService, ModuleContext, FindControllerService],
})
export class EnrichmentTableViewerComponent implements OnDestroy, ModuleAwareComponent {
  encodeURIComponent = encodeURIComponent;

  constructor(
    protected readonly route: ActivatedRoute,
    protected readonly worksheetViewerService: EnrichmentTableService,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly errorHandler: ErrorHandler,
    protected readonly enrichmentService: EnrichmentService,
    protected readonly progressDialog: ProgressDialog,
    protected readonly filesystemObjectActions: FilesystemObjectActions,
    private readonly findControllerService: FindControllerService,
  ) {
    this.annotation = this.parseAnnotationFromUrl(this.route.snapshot.fragment);

    this.findControllerService.type$.next(this.annotation.id.length ? 'annotation' : 'text');
    this.findControllerService.query$.next(
      this.annotation.id.length ? this.annotation.id : this.annotation.text,
    );
  }

  @ViewChild(EnrichmentTableComponent) enrichmentTable: EnrichmentTableComponent;

  annotation: AnnotationData;
  private destroy$ = new Subject<any>();

  fileIdChange$ = new ReplaySubject<string>(1);

  set fileId(id: string) {
    this.fileIdChange$.next(id);
  }

  fileId$: Observable<string> = merge(
    this.fileIdChange$,
    this.route.params.pipe(
      map(({file_id}) => file_id),
      filter((fileId) => !!fileId),
    ),
  );
  object$: Observable<FilesystemObject> = this.fileId$.pipe(
    switchMap((fileId) => this.enrichmentService.get(fileId)),
    shareReplay(),
  );
  document$: Observable<EnrichmentDocument> = this.fileId$.pipe(
    switchMap((fileId) =>
      this.enrichmentService
        .getContent(fileId)
        .pipe(
          mergeScan(
            (document, blob) => document.loadResult(blob, fileId),
            new EnrichmentDocument(this.worksheetViewerService),
          ),
          switchMap((document) =>
            document.changed$.pipe(
              map(() => document),
              startWith(document),
            ),
          ),
        ),
    ),
    shareReplay(),
  );
  table$: Observable<EnrichmentTable> = this.document$.pipe(
    mergeScan((table, document) => table.load(document), new EnrichmentTable()),
    this.errorHandler.create({label: 'Load enrichment table'}),
    shareReplay(),
  );
  modulePropertiesChange = this.object$.pipe(
    map((object) => ({
      title: object ? object.filename : 'Enrichment Table',
      fontAwesomeIcon: 'table',
    })),
  );
  findController$: Observable<AsyncElementFind> = this.findControllerService.elementFind$;

  /**
   * Keeps tracks of changes so they aren't saved to the server until you hit 'Save'. However,
   * due to the addition of annotations to enrichment tables, this feature has been broken.
   */
  queuedChanges$ = new BehaviorSubject<ObjectUpdateRequest | undefined>(null);

  dragTitleData$ = defer(() => this.object$.pipe(map((object) => object.getTransferData())));

  scrollTop() {
    this.enrichmentTable.scrollTop();
  }

  ngOnDestroy() {
    this.destroy$.next();
  }

  parseAnnotationFromUrl(fragment: string): AnnotationData {
    const params = new URLSearchParams(fragment);
    return {
      id: params.get('id') || '',
      text: params.get('text') || '',
      color: params.get('color') || '',
    };
  }

  restore(version: ObjectVersion) {
    this.document$ = this.fileId$.pipe(
      mergeScan(
        (document, fileId) => document.loadResult(version.contentValue, fileId),
        new EnrichmentDocument(this.worksheetViewerService)
      ),
      tap(() => this.queuedChanges$.next(this.queuedChanges$.value || {})),
        shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap((document) => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Restore enrichment table'}),
      shareReplay(),
    );
  }

  refreshData() {
    this.table$ = combineLatest(this.document$, this.table$).pipe(
      take(1),
      mergeMap(([document, table]) =>
        document.refreshData().pipe(
          mergeMap(() => new EnrichmentTable().load(document)),
          tap((newTable) => {
            this.snackBar.open(`Data refreshed.`, 'Close', {duration: 5000});
          }),
        ),
      ),
      shareReplay(),
      this.errorHandler.create({label: 'Load enrichment table'}),
    );
  }

  save() {
    const progressDialogRef = this.progressDialog.display({
      title: 'Working...',
      progressObservables: [
        new BehaviorSubject<Progress>(
          new Progress({
            status: 'Saving enrichment table...',
          }),
        ),
      ],
    });
    const observable = combineLatest(
      this.object$,
      this.document$.pipe(
        // need to use updateParameters instead of save
        // because save only update the import genes list
        // not the matched results
        // so a new version of the file will not get created
        // the newly added gene matched
        mergeMap((document) => document.updateParameters()),
      ),
    ).pipe(
      take(1),
      mergeMap(([object, blob]) =>
        this.enrichmentService.save([object.hashId], {
          contentValue: blob,
          ...this.queuedChanges$.value,
        }),
      ),
      map(() => {
        this.refreshData();
      }),
      tap(() => this.queuedChanges$.next(null)),
      this.errorHandler.create({label: 'Save enrichment table'}),
      shareReplay(),
      finalize(() => progressDialogRef.close()),
    );

    observable.subscribe(() => {
      this.snackBar.open(`Enrichment table saved.`, 'Close', {duration: 5000});
    });

    return observable;
  }

  openNewWindow(enrichmentTable: FilesystemObject) {
    return this.filesystemObjectActions.openNewWindow(enrichmentTable);
  }

  /**
   * Opens EnrichmentTableOrderDialog that gives new column order.
   */
  openOrderDialog() {
    this.document$.pipe(take(1)).subscribe((document) => {
      const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
      dialogRef.componentInstance.domains = [...document.domains];
      return dialogRef.result.then(
        (result) => {
          if (document.domains !== result) {
            document.domains = result;
            this.queuedChanges$.next(this.queuedChanges$.value || {});
            this.table$ = new EnrichmentTable()
              .load(document)
              .pipe(
                this.errorHandler.create({label: 'Re-order enrichment table'}),
                shareReplay(),
              );
          }
        },
        () => {
        },
      );
    });
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentTableEditDialog(
    object: FilesystemObject,
    document: EnrichmentDocument,
  ): Promise<void> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.promptObject = false;
    dialogRef.componentInstance.object = object;
    dialogRef.componentInstance.document = document;
    dialogRef.componentInstance.fileId = this.fileId;
    dialogRef.componentInstance.accept = (result: EnrichmentTableEditDialogValue) => {
      this.queueChange(result.objectChanges);
      document.setParameters(result.documentChanges);
      this.save();
    };
    return dialogRef.result;
  }

  queueChange(change: Partial<ObjectUpdateRequest>) {
      this.queuedChanges$.next({
        ...(this.queuedChanges$.value || {}),
      ...change,
    });
  }

  switchToTextFind() {
    this.annotation = {id: '', text: '', color: ''};
    this.findControllerService.type$.next('text');
  }

  switchToAnnotationFind(id: string, text: string, color: string) {
    this.annotation = {id, text, color};
    this.findControllerService.type$.next('annotation');
  }

  startAnnotationFind(annotationId: string, annotationText: string, annotationColor: string) {
    this.switchToAnnotationFind(annotationId, annotationText, annotationColor);
    this.findControllerService.query$.next(annotationId);
  }

  startTextFind(text: string) {
    this.switchToTextFind();
    this.findControllerService.query$.next(text);
  }
}
