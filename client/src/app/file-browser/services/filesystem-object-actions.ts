import { Injectable } from '@angular/core';
import { ObjectDeleteDialogComponent } from '../components/dialog/object-delete-dialog.component';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { BehaviorSubject, forkJoin, from, merge, of } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { finalize, map, mergeMap, take } from 'rxjs/operators';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { FilesystemObject } from '../models/filesystem-object';
import { MessageArguments, MessageDialog } from '../../shared/services/message-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ObjectSelectionDialogComponent } from '../components/dialog/object-selection-dialog.component';
import { FilesystemService } from './filesystem.service';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../components/dialog/object-edit-dialog.component';
import { getObjectLabel } from '../utils/objects';
import { clone } from 'lodash';
import { ObjectVersionHistoryDialogComponent } from '../components/dialog/object-version-history-dialog.component';
import { ObjectVersion } from '../models/object-version';
import {
  ObjectExportDialogComponent,
  ObjectExportDialogValue,
} from '../components/dialog/object-export-dialog.component';
import { openDownloadForBlob } from '../../shared/utils/files';
import { FileAnnotationHistoryDialogComponent } from '../components/dialog/file-annotation-history-dialog.component';
import { AnnotationsService } from './annotations.service';
import { ObjectCreationService } from './object-creation.service';
import { ObjectTypeService } from './object-type.service';
import { ResultMapping } from 'app/shared/schemas/common';
import { AnnotationGenerationResultData } from '../schema';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';

@Injectable()
export class FilesystemObjectActions {

  constructor(protected readonly annotationsService: AnnotationsService,
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
              protected readonly objectTypeService: ObjectTypeService) {
  }

  protected createProgressDialog(message: string, title = 'Working...') {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: message,
    }));
    return this.progressDialog.display({
      title,
      progressObservable,
    });
  }

  /**
   * Open the dialog to export an object.
   * @param target the object to export
   */
  openExportDialog(target: FilesystemObject): Promise<boolean> {
    return this.objectTypeService.get(target).pipe(
      mergeMap(typeProvider => typeProvider.getExporters(target)),
      mergeMap(exporters => {
        if (exporters.length) {
          const dialogRef = this.modalService.open(ObjectExportDialogComponent);
          dialogRef.componentInstance.title = `Export ${getObjectLabel(target)}`;
          dialogRef.componentInstance.exporters = exporters;
          dialogRef.componentInstance.accept = (value: ObjectExportDialogValue) => {
            const progressDialogRef = this.createProgressDialog('Generating export...');

            try {
              return value.exporter.export().pipe(
                take(1), // Must do this due to RxJs<->Promise<->etc. tomfoolery
                finalize(() => progressDialogRef.close()),
                map((file: File) => {
                  openDownloadForBlob(file, file.name);
                  return true;
                }),
                this.errorHandler.create({label: 'Export object'}),
              ).toPromise();
            } catch (e) {
              progressDialogRef.close();
              throw e;
            }
          };

          return from(dialogRef.result.catch(() => false));
        } else {
          this.messageDialog.display({
            title: 'No Export Formats',
            message: `No export formats are supported for ${getObjectLabel(target)}.`,
            type: MessageType.Warning,
          } as MessageArguments);
          return of(false);
        }
      }),
    ).toPromise();
  }

  /**
   * Open a dialog to upload a file.
   * @param parent the folder to put the new file in
   */
  openUploadDialog(parent: FilesystemObject): Promise<any> {
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
    destination: FilesystemObject,
  }> {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.title = `Move ${getObjectLabel(targets)}`;
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    dialogRef.componentInstance.accept = ((destinations: FilesystemObject[]) => {
      const destination = destinations[0];

      const progressDialogRef = this.createProgressDialog(`Moving  ${getObjectLabel(targets)}...`);

      return this.filesystemService.save(targets.map(target => target.hashId), {
        parentHashId: destination.hashId,
      }, Object.assign({}, ...targets.map(target => ({[target.hashId]: target}))))
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
          this.errorHandler.create({label: 'Move object'}),
        )
        .toPromise()
        .then(() => ({
          destination,
        }));
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to edit the provided file.
   * @param target the file to edit
   */
  openEditDialog(target: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(ObjectEditDialogComponent);
    dialogRef.componentInstance.object = target;
    this.annotationsService.getAnnotationSelections(target.hashId).subscribe(configs => {
      dialogRef.componentInstance.configs = configs.annotationConfigs;
      dialogRef.componentInstance.accept = ((changes: ObjectEditDialogValue) => {
        const progressDialogRef = this.createProgressDialog(`Saving changes to ${getObjectLabel(target)}...`);
        return this.filesystemService.save([target.hashId], changes.request, {
          [target.hashId]: target,
        })
          .pipe(
            finalize(() => progressDialogRef.close()),
            this.errorHandler.createFormErrorHandler(dialogRef.componentInstance.form),
            this.errorHandler.create({label: 'Edit object'}),
          )
          .toPromise();
      });
    });
    return dialogRef.result;
  }

  openDeleteDialog(targets: FilesystemObject[]): Promise<any> {
    const dialogRef = this.modalService.open(ObjectDeleteDialogComponent);
    dialogRef.componentInstance.objects = targets;
    dialogRef.componentInstance.accept = (() => {
      const progressDialogRef = this.createProgressDialog(`Deleting ${getObjectLabel(targets)}...`);
      return this.filesystemService.delete(targets.map(target => target.hashId))
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Delete object'}),
        )
        .toPromise();
    });
    return dialogRef.result;
  }

  openFileAnnotationHistoryDialog(object: FilesystemObject): Promise<any> {
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

  openVersionHistoryDialog(target: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(ObjectVersionHistoryDialogComponent, {
      size: 'xl',
    });
    dialogRef.componentInstance.object = target;
    return dialogRef.result;
  }

  openShareDialog(object: FilesystemObject, forEditing = false): Promise<any> {
    const modalRef = this.modalService.open(ShareDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/${object.getURL(forEditing)}`;
    return modalRef.result;
  }

  reannotate(targets: FilesystemObject[]): Promise<any> {
    const progressDialogRef = this.createProgressDialog('Identifying annotations...');
    // it's better to have separate service calls for each file
    // and let each finish independently
    const annotationRequests = targets.map(
      object => {
        const annotationConfigs = object.annotationConfigs;
        const organism = object.fallbackOrganism;
        return this.annotationsService.generateAnnotations(
          [object.hashId], {annotationConfigs, organism});
      });

    const results: ResultMapping<AnnotationGenerationResultData>[] = [];
    return forkJoin(annotationRequests).pipe(
      mergeMap(res => merge(res)),
      map(result => results.push(result)),
      finalize(() => {
        progressDialogRef.close();
        const modalRef = this.modalService.open(ObjectReannotateResultsDialogComponent);
        modalRef.componentInstance.objects = targets;
        modalRef.componentInstance.results = results;
      }),
      this.errorHandler.create({label: 'Re-annotate object'}),
    ).toPromise();
  }
}
