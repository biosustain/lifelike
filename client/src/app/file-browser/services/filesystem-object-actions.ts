import { Injectable } from '@angular/core';
import { EnrichmentTableCreateDialogComponent } from '../components/enrichment-table-create-dialog.component';
import { ObjectDeleteDialogComponent } from '../components/dialog/object-delete-dialog.component';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { BehaviorSubject, Observable } from 'rxjs';
import { Progress, ProgressMode } from '../../interfaces/common-dialog.interface';
import { filter, finalize, map, mergeMap, tap } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { DIRECTORY_MIMETYPE, FilesystemObject, MAP_MIMETYPE } from '../models/filesystem-object';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ObjectSelectionDialogComponent } from '../components/dialog/object-selection-dialog.component';
import { FilesystemService } from './filesystem.service';
import { ObjectEditDialogComponent, ObjectEditDialogValue } from '../components/dialog/object-edit-dialog.component';
import { getObjectLabel } from '../utils/objects';
import { AnnotationGenerationRequest, ObjectCreateRequest } from '../schema';
import { clone } from 'lodash';
import { ObjectVersionHistoryDialogComponent } from '../components/dialog/object-version-history-dialog.component';
import { ObjectVersion } from '../models/object-version';
import { EnrichmentTableEditDialogComponent } from '../components/enrichment-table-edit-dialog.component';
import {
  ObjectExportDialogComponent,
  ObjectExportDialogValue,
} from '../components/dialog/object-export-dialog.component';
import { openDownloadForBlob } from '../../shared/utils/files';
import { FileAnnotationHistoryDialogComponent } from '../components/dialog/file-annotation-history-dialog.component';
import { AnnotationsService } from './annotations.service';

@Injectable()
export class FilesystemObjectActions {

  constructor(protected readonly filesService: PdfFilesService,
              protected readonly annotationsService: AnnotationsService,
              protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService) {
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
    if (target.exportFormats.length) {
      const dialogRef = this.modalService.open(ObjectExportDialogComponent);
      dialogRef.componentInstance.object = target;
      dialogRef.componentInstance.accept = (value: ObjectExportDialogValue) => {
        const progressDialogRef = this.createProgressDialog('Generating export...');
        let content$: Observable<Blob>;
        let filename = target.filename;
        if (!filename.endsWith(value.extension)) {
          filename += value.extension;
        }

        // If the user is getting the original format, then we'll just use the existing endpoint
        if (value.request.format === target.originalFormat) {
          content$ = this.filesystemService.getContent(target.hashId);
        } else {
          content$ = this.filesystemService.generateExport(value.object.hashId, value.request);
        }

        return content$.pipe(
          finalize(() => progressDialogRef.close()),
          map(blob => {
            openDownloadForBlob(blob, filename);
            return true;
          }),
          this.errorHandler.create(),
        ).toPromise();
      };
      return dialogRef.result;
    } else {
      this.messageDialog.display({
        title: 'No Export Formats',
        message: `No export formats are supported for ${getObjectLabel(target)}.`,
        type: MessageType.Warning,
      });
      return Promise.reject();
    }
  }

  /**
   * Handles the filesystem PUT request with a progress dialog.
   * @param request the request data
   * @param annotationOptions options for the annotation process
   * @return the created object
   */
  protected executePutWithProgressDialog(request: ObjectCreateRequest,
                                         annotationOptions: AnnotationGenerationRequest = {}):
    Observable<FilesystemObject> {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing...',
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${request.filename}'`,
      progressObservable,
    });

    return this.filesystemService.create(request)
      .pipe(
        tap(event => {
          // First we show progress for the upload itself
          if (event.type === HttpEventType.UploadProgress) {
            if (event.loaded === event.total && event.total) {
              progressObservable.next(new Progress({
                mode: ProgressMode.Indeterminate,
                status: 'File transmitted; saving...',
              }));
            } else {
              progressObservable.next(new Progress({
                mode: ProgressMode.Determinate,
                status: 'Transmitting file...',
                value: event.loaded / event.total,
              }));
            }
          }
        }),
        filter(event => event.bodyValue != null),
        map((event): FilesystemObject => event.bodyValue),
        mergeMap((object: FilesystemObject) => {
          // Then we show progress for the annotation generation (although
          // we can't actually show a progress percentage)
          progressObservable.next(new Progress({
            mode: ProgressMode.Indeterminate,
            status: 'Saved; identifying annotations...',
          }));
          return this.annotationsService.generateAnnotations(
            [object.hashId], annotationOptions,
          ).pipe(
            map(() => object), // This method returns the object
          );
        }),
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create(),
      );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: CreateDialogOptions = {}): Promise<FilesystemObject> {
    const dialogRef = this.modalService.open(ObjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New File';
    dialogRef.componentInstance.object = target;
    const keys: Array<keyof CreateDialogOptions> = [
      'promptUpload',
      'promptAnnotationOptions',
      'promptParent',
      'parentLabel',
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = ((value: ObjectEditDialogValue) => {
      return this.executePutWithProgressDialog({
        ...value.request,
        ...(options.request || {}),
      }, {
        annotationMethod: value.annotationMethod,
        organism: value.organism,
      }).toPromise();
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to upload a file.
   * @param parent the folder to put the new file in
   */
  openUploadDialog(parent: FilesystemObject): Promise<any> {
    const object = new FilesystemObject();
    object.parent = parent;
    return this.openCreateDialog(object, {
      title: 'Upload File',
      promptUpload: true,
      promptAnnotationOptions: true,
    });
  }

  /**
   * Open a dialog to clone an object.
   * @param target the object to clone
   */
  openCloneDialog(target: FilesystemObject): Promise<FilesystemObject> {
    const object = clone(target);
    object.filename = object.filename.replace(/^(.+?)(\.[^.]+)?$/, '$1 (Copy)$2');
    return this.openCreateDialog(object, {
      title: `Make Copy of ${getObjectLabel(target)}`,
      promptParent: true,
      parentLabel: 'Copy To',
      request: {
        contentHashId: target.hashId,
        contentUrl: null,
        contentValue: null,
      },
    });
  }

  /**
   * Open a dialog to create a new folder in another folder.
   * @param parent the folder to put the new folder in
   */
  openDirectoryCreateDialog(parent?: FilesystemObject): Promise<FilesystemObject> {
    const object = new FilesystemObject();
    object.filename = 'New Folder';
    object.mimeType = DIRECTORY_MIMETYPE;
    object.parent = parent;
    return this.openCreateDialog(object, {
      title: 'New Folder',
    });
  }

  /**
   * Open a dialog to create a new map in another folder.
   * @param options options for the dialog
   */
  openMapCreateDialog(options: MapCreateDialogOptions = {}): Promise<FilesystemObject> {
    const object = new FilesystemObject();
    object.filename = 'Untitled Map';
    object.mimeType = MAP_MIMETYPE;
    object.parent = options.parent;
    return this.openCreateDialog(object, {
      title: 'New Map',
      request: {
        contentValue: new Blob([JSON.stringify({
          edges: [],
          nodes: [],
        })], {
          type: MAP_MIMETYPE,
        }),
      },
      ...(options.createDialog || {}),
    });
  }

  openEnrichmentTableCreateDialog(parent: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableCreateDialogComponent);
    return dialogRef.result.then((result) => {
      const progressDialogRef = this.createProgressDialog('Creating map...');

      const enrichmentData = result.entitiesList.replace(/[\/\n\r]/g, ',') + '/' + result.organism + '/' + result.domainsList.join(',');
      return this.filesService.addGeneList(parent.locator.projectName, parent.directory.id, enrichmentData, result.description, result.name)
        .pipe(
          this.errorHandler.create(),
          finalize(() => progressDialogRef.close()),
        )
        .toPromise();
    });
  }

  openEnrichmentTableEditDialog(target: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.fileId = target.id;
    dialogRef.componentInstance.projectName = target.locator.projectName;
    return dialogRef.result.then((result) => {
      const progressDialogRef = this.createProgressDialog('Saving changes...');

      const enrichmentData = result.entitiesList.replace(/[\/\n\r]/g, ',') + '/' + result.organism + '/' + result.domainsList.join(',');
      return this.filesService.editGeneList(
        target.locator.projectName,
        target.id,
        enrichmentData,
        result.name,
        result.description,
      )
        .pipe(
          this.errorHandler.create(),
          finalize(() => progressDialogRef.close()),
        )
        .toPromise();
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
          this.errorHandler.create(),
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
    dialogRef.componentInstance.accept = ((changes: ObjectEditDialogValue) => {
      const progressDialogRef = this.createProgressDialog(`Saving changes to ${getObjectLabel(target)}...`);
      return this.filesystemService.save([target.hashId], changes.request, {
        [target.hashId]: target,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create(),
        )
        .toPromise();
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
          this.errorHandler.create(),
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
    return this.annotationsService.generateAnnotations(targets.map(object => object.hashId))
      .pipe(
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create(),
      )
      .toPromise();
  }
}

export class MapCreateDialogOptions {
  parent?: FilesystemObject;
  createDialog?: Omit<CreateDialogOptions, 'request'>;
}

export class CreateDialogOptions {
  title?: string;
  promptUpload?: boolean;
  promptAnnotationOptions?: boolean;
  promptParent?: boolean;
  parentLabel?: string;
  request?: Partial<ObjectCreateRequest>;
}
