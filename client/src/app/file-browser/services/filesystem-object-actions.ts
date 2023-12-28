import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, forkJoin, from, merge, Observable, of } from 'rxjs';
import { finalize, map, mergeMap, take, tap } from 'rxjs/operators';
import { clone, defaults, first } from 'lodash-es';

import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { openDownloadForBlob } from 'app/shared/utils/files';
import { ResultMapping } from 'app/shared/schemas/common';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { Exporter } from 'app/file-types/providers/base-object.type-provider';

import { ObjectDeleteDialogComponent } from '../components/dialog/object-delete-dialog.component';
import { FilesystemObject } from '../models/filesystem-object';
import { ObjectSelectionDialogComponent } from '../components/dialog/object-selection-dialog.component';
import { FilesystemService } from './filesystem.service';
import { getObjectLabel } from '../utils/objects';
import { ObjectVersionHistoryDialogComponent } from '../components/dialog/object-version-history-dialog.component';
import { ObjectVersion } from '../models/object-version';
import {
  ObjectExportDialogComponent,
  ObjectExportDialogValue,
} from '../components/dialog/object-export-dialog.component';
import { FileAnnotationHistoryDialogComponent } from '../components/dialog/file-annotation-history-dialog.component';
import { AnnotationsService } from './annotations.service';
import { ObjectCreationService } from './object-creation.service';
import { AnnotationGenerationResultData } from '../schema';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';
import { ObjectEditDialogValue } from '../components/dialog/object-edit-dialog.component';

@Injectable()
export class FilesystemObjectActions {
  constructor(
    protected readonly annotationsService: AnnotationsService,
    protected readonly router: Router,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly progressDialog: ProgressDialog,
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly messageDialog: MessageDialog,
    protected readonly errorHandler: ErrorHandler,
    protected readonly filesystemService: FilesystemService,
    protected readonly objectCreationService: ObjectCreationService,
    protected readonly objectTypeService: ObjectTypeService,
    protected readonly clipboard: ClipboardService
  ) {}

  createProgressDialog(message: string, title = 'Working...') {
    const progressObservables = [
      new BehaviorSubject<Progress>(
        new Progress({
          status: message,
        })
      ),
    ];
    return this.progressDialog.display({
      title,
      progressObservables,
    });
  }

  export(
    {
      exporter,
      exportLinked,
    }: {
      exporter: Exporter;
      exportLinked: boolean;
    },
    options?: { label: string }
  ): Promise<boolean> {
    const { label } = defaults(options, { label: 'Export object' });
    const progressDialogRef = this.createProgressDialog('Generating export...');
    try {
      return exporter
        .export(exportLinked)
        .pipe(
          take(1), // Must do this due to RxJs<->Promise<->etc. tomfoolery
          finalize(() => progressDialogRef.close()),
          map((file: File) => {
            openDownloadForBlob(file, file.name);
            return true;
          }),
          this.errorHandler.create({ label })
        )
        .toPromise();
    } catch (e) {
      progressDialogRef.close();
      throw e;
    }
  }

  exportDismissFactory =
    (target: FilesystemObject, overwrites: Partial<MessageArguments> = {}) =>
    (error: boolean): Observable<boolean> => {
      if (error) {
        this.messageDialog.display({
          title: 'No Export Formats',
          message: `No export formats are supported for ${getObjectLabel(target)}.`,
          type: MessageType.Warning,
          ...overwrites,
        });
      }
      return of(false);
    };

  /**
   * Open the dialog to export an object.
   * @param target the object to export
   */
  openExportDialog(
    target: FilesystemObject,
    inputs: {
      exporters?: Exporter[];
      title?: string;
      target?: FilesystemObject;
      accept?: (value: ObjectExportDialogValue) => Promise<boolean>;
      dismiss?: (error: boolean) => Observable<boolean>;
    } = {}
  ): Promise<boolean> {
    const dialogRef = this.modalService.open(ObjectExportDialogComponent);
    Object.assign(
      dialogRef.componentInstance,
      defaults(inputs, {
        title: `Export ${getObjectLabel(target)}`,
        target,
        accept: (value: ObjectExportDialogValue) => this.export(value, { label: 'Export object' }),
        dismiss: this.exportDismissFactory(target, {}),
      })
    );
    return from(dialogRef.result.catch(() => false)).toPromise();
  }

  /**
   * Open a dialog to upload a file.
   * @param parent the folder to put the new file in
   */
  openUploadDialog(parent: FilesystemObject): Promise<FilesystemObject> {
    const object = new FilesystemObject();
    object.parent = parent;
    return this.objectCreationService.openCreateDialog(object, {
      title: 'Upload File',
      promptUpload: true,
    });
  }

  /**
   * Open a dialog to clone an object.
   * @param target the object to clone
   */
  openCloneDialog(target: FilesystemObject): Promise<FilesystemObject> {
    const object = clone(target);
    object.filename = object.filename.replace(/^(.+?)(\.[^.]+)?$/, '$1 (Copy)$2');
    if (object.parent == null || !object.parent.privileges.writable) {
      object.parent = null;
    }
    return this.objectCreationService.openCreateDialog(object, {
      title: `Make Copy of ${getObjectLabel(target)}`,
      promptParent: true,
      parentLabel: 'Copy To',
      request: {
        contentHashId: target.hashId,
      },
    });
  }

  /**
   * Open a dialog to move selected objects to a new location.
   * @param targets the objects to move
   */
  openMoveDialog(targets: FilesystemObject[]): Promise<{
    destination: FilesystemObject;
  }> {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.hashId = first(targets).parent.hashId;
    dialogRef.componentInstance.title = `Move ${getObjectLabel(targets)}`;
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    dialogRef.componentInstance.accept = (destinations: FilesystemObject[]) => {
      const destination = destinations[0];

      const progressDialogRef = this.createProgressDialog(`Moving  ${getObjectLabel(targets)}...`);

      return this.filesystemService
        .save(
          targets.map((target) => target.hashId),
          {
            parentHashId: destination.hashId,
          },
          Object.assign({}, ...targets.map((target) => ({ [target.hashId]: target })))
        )
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
          this.errorHandler.create({ label: 'Move object' })
        )
        .toPromise()
        .then(() => ({
          destination,
        }));
    };
    return dialogRef.result;
  }

  /**
   * Open a dialog to edit the provided file.
   * @param target the file to edit
   */
  openEditDialog(target: FilesystemObject): Promise<ObjectEditDialogValue> {
    return this.objectTypeService
      .get(target)
      .pipe(
        mergeMap((typeProvider) => from(typeProvider.openEditDialog(target))),
        take(1)
      )
      .toPromise();
  }

  openDeleteDialog(targets: FilesystemObject[]): Promise<ObjectEditDialogValue> {
    const dialogRef = this.modalService.open(ObjectDeleteDialogComponent);
    dialogRef.componentInstance.objects = targets;
    dialogRef.componentInstance.accept = () => {
      const progressDialogRef = this.createProgressDialog(`Deleting ${getObjectLabel(targets)}...`);
      return this.filesystemService
        .delete(targets.map((target) => target.hashId))
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({ label: 'Delete object' })
        )
        .toPromise();
    };
    return dialogRef.result;
  }

  openFileAnnotationHistoryDialog(object: FilesystemObject): Promise<void> {
    const dialogRef = this.modalService.open(FileAnnotationHistoryDialogComponent, {
      size: 'lg',
    });
    dialogRef.componentInstance.object = object;
    return dialogRef.result;
  }

  openVersionRestoreDialog(target: FilesystemObject): Promise<ObjectVersion> {
    const dialogRef = this.modalService.open(ObjectVersionHistoryDialogComponent, {
      size: 'xl',
    });
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.promptRestore = true;
    return dialogRef.result;
  }

  openVersionHistoryDialog(target: FilesystemObject): Promise<ObjectVersion | null> {
    const dialogRef = this.modalService.open(ObjectVersionHistoryDialogComponent, {
      size: 'xl',
    });
    dialogRef.componentInstance.object = target;
    return dialogRef.result;
  }

  openShareDialog(object: FilesystemObject, forEditing = false): Promise<boolean> {
    return Promise.resolve(this.clipboard.copy(object.getURL(forEditing).toAbsolute().toString()));
  }

  openNewWindow(object: FilesystemObject, forEditing = false) {
    const objectPath = `${object.getURL(forEditing)}`;
    return window.open(objectPath);
  }

  reannotate(targets: FilesystemObject[]): Promise<ResultMapping<AnnotationGenerationResultData>> {
    const progressDialogRef = this.createProgressDialog('Parsing and identifying annotations...');
    // it's better to have separate service calls for each file
    // and let each finish independently
    const annotationRequests = targets.map((object) => {
      const annotationConfigs = object.annotationConfigs;
      const organism = object.fallbackOrganism;
      return this.annotationsService.generateAnnotations([object.hashId], {
        annotationConfigs,
        organism,
      }).body$;
    });

    const results: ResultMapping<AnnotationGenerationResultData>[] = [];
    return forkJoin(annotationRequests)
      .pipe(
        mergeMap((res) => merge(res)),
        tap((result) => results.push(result)),
        finalize(() => {
          const check = [];
          progressDialogRef.close();
          results.forEach((result) =>
            Object.entries(result.mapping).forEach((r) => {
              check.push(r[1].success);
            })
          );
          if (check.some((c) => c === false)) {
            const modalRef = this.modalService.open(ObjectReannotateResultsDialogComponent);
            modalRef.componentInstance.objects = targets;
            modalRef.componentInstance.results = results;
          }
        }),
        this.errorHandler.create({ label: 'Re-annotate object' })
      )
      .toPromise();
  }

  updateStarred(hashId: string, starred: boolean) {
    return this.filesystemService.updateStarred(hashId, starred).toPromise();
  }

  updatePinned(object: FilesystemObject) {
    if (object.privileges.writable) {
      return this.filesystemService
        .save(
          [object.hashId],
          { pinned: !object.pinned, parentHashId: object.parent.hashId },
          { [object.hashId]: object }
        )
        .pipe(this.errorHandler.create({ label: 'Edit object' }))
        .toPromise();
    }
  }
}
