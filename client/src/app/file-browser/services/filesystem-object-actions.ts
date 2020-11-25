import { Injectable } from '@angular/core';
import { EnrichmentTableCreateDialogComponent } from '../components/enrichment-table-create-dialog.component';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { ObjectDeleteDialogComponent } from '../components/dialog/object-delete-dialog.component';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ProjectPageService } from './project-page.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { Progress, ProgressMode } from '../../interfaces/common-dialog.interface';
import { filter, finalize, map, tap } from 'rxjs/operators';
import { HttpEventType } from '@angular/common/http';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { DIRECTORY_MIMETYPE, FilesystemObject, MAP_MIMETYPE } from '../models/filesystem-object';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DefaultMap } from '../../shared/utils/collections';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ObjectSelectionDialogComponent } from '../components/dialog/object-selection-dialog.component';
import { FilesystemService } from './filesystem.service';
import { ObjectEditDialogComponent, ObjectEditDialogValue } from '../components/dialog/object-edit-dialog.component';
import { getObjectLabel } from '../utils/objects';
import { ObjectCreateRequest } from '../schema';
import { clone } from 'lodash';
import { ObjectVersionHistoryDialogComponent } from '../components/dialog/object-version-history-dialog.component';
import { ObjectVersion } from '../models/object-version';
import { EnrichmentTableEditDialogComponent } from '../components/enrichment-table-edit-dialog.component';
import {
  ObjectExportDialogComponent,
  ObjectExportDialogValue,
} from '../components/dialog/object-export-dialog.component';
import { openDownloadForBlob } from '../../shared/utils/files';

@Injectable()
export class FilesystemObjectActions {

  constructor(private readonly filesService: PdfFilesService,
              private readonly router: Router,
              private readonly snackBar: MatSnackBar,
              private readonly modalService: NgbModal,
              private readonly progressDialog: ProgressDialog,
              private readonly route: ActivatedRoute,
              private readonly projectPageService: ProjectPageService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly ngbModal: NgbModal,
              private readonly messageDialog: MessageDialog,
              private readonly errorHandler: ErrorHandler,
              private readonly filesystemService: FilesystemService) {
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
   * Create a download dialog for the provided object.
   * @param target the object to download
   */
  openDownloadDialog(target: FilesystemObject): Promise<boolean> {
    const progressDialogRef = this.createProgressDialog('Downloading file...');
    return this.filesystemService.getContent(target.hashId).pipe(
      finalize(() => progressDialogRef.close()),
      map(blob => {
        openDownloadForBlob(blob, target.downloadFilename);
        return true;
      }),
      this.errorHandler.create(),
    ).toPromise();
  }

  /**
   * Open the dialog to export an object.
   * @param target the object to export
   */
  openExportDialog(target: FilesystemObject): Promise<boolean> {
    if (target.exportFormats.length) {
      const dialogRef = this.ngbModal.open(ObjectExportDialogComponent);
      dialogRef.componentInstance.object = target;
      dialogRef.componentInstance.accept = (value: ObjectExportDialogValue) => {
        const progressDialogRef = this.createProgressDialog('Generating export...');
        return this.filesystemService.generateExport(value.object.hashId, value.request).pipe(
          finalize(() => progressDialogRef.close()),
          map(blob => {
            openDownloadForBlob(blob, `${target.downloadFilename}${value.extension}`);
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
   * @return the created object
   */
  protected executePutWithProgressDialog(request: ObjectCreateRequest): Observable<FilesystemObject> {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing...',
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${request.filename}'`,
      progressObservable,
    });

    return this.filesystemService.put(request)
      .pipe(
        finalize(() => progressDialogRef.close()),
        tap(event => {
          if (event.type === HttpEventType.UploadProgress) {
            progressObservable.next(new Progress({
              mode: ProgressMode.Determinate,
              status: 'Uploading file...',
              value: event.loaded / event.total,
            }));
          }
        }),
        filter(event => event.bodyValue != null),
        map(event => event.bodyValue),
        this.errorHandler.create(),
      );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: Partial<CreateDialogOptions>): Promise<FilesystemObject> {
    const dialogRef = this.ngbModal.open(ObjectEditDialogComponent);
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
   * @param parent the folder to put the new map in
   */
  openMapCreateDialog(parent?: FilesystemObject): Promise<FilesystemObject> {
    const object = new FilesystemObject();
    object.filename = 'Untitled Map';
    object.mimeType = MAP_MIMETYPE;
    object.parent = parent;
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

  openVersionRestoreDialog(target: FilesystemObject): Promise<ObjectVersion> {
    const dialogRef = this.modalService.open(ObjectVersionHistoryDialogComponent, {
      size: 'xl',
    });
    dialogRef.componentInstance.object = target;
    dialogRef.componentInstance.promptRestore = true;
    return dialogRef.result;
  }

  openVersionHistoryDialog(target: FilesystemObject): Promise<ObjectVersion> {
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

  // ========================================
  // Actions
  // ========================================

  reannotate(targets: readonly FilesystemObject[]): Promise<any> {
    const filteredTargets: FilesystemObject[] = targets
      .filter(object => object.type === 'file' && object.name.slice(object.name.length - 11) !== '.enrichment');

    if (filteredTargets.length) {
      const progressObservable = new BehaviorSubject<Progress>(new Progress({
        status: 'Re-creating annotations in file...',
        mode: ProgressMode.Buffer,
      }));

      const progressDialogRef = this.progressDialog.display({
        title: `Reannotating file${filteredTargets.length === 1 ? '' : 's'}...`,
        progressObservable,
      });

      const filesByProject = new DefaultMap<string, PdfFile[]>(() => []);
      for (const target of filteredTargets) {
        filesByProject.get(target.locator.projectName).push(target.data as PdfFile);
      }

      return combineLatest([...filesByProject.entries()].map(([projectName, files]) => {
        const ids: string[] = files.map((file: PdfFile) => file.file_id);
        return this.filesService.reannotateFiles(projectName, ids);
      })).pipe(
        finalize(() => {
          progressDialogRef.close();
        }),
        this.errorHandler.create(),
      ).toPromise();
    } else {
      this.messageDialog.display({
        title: 'Nothing to Re-annotate',
        message: 'No files were selected to re-annotate.',
        type: MessageType.Warning,
      });
    }
  }
}

class DeletionError {
  constructor(readonly message: string) {
  }
}

export class CreateDialogOptions {
  title: string;
  promptUpload: boolean;
  promptAnnotationOptions: boolean;
  promptParent: boolean;
  parentLabel: string;
  request: Partial<ObjectCreateRequest>;
}
