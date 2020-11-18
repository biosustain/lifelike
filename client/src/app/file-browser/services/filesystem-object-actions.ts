import { Injectable } from '@angular/core';
import { ObjectUploadDialogComponent } from '../components/object-upload-dialog.component';
import { DirectoryEditDialogComponent } from '../components/directory-edit-dialog.component';
import { Directory } from './project-space.service';
import { MapCreateDialogComponent } from '../../drawing-tool/components/map-create-dialog.component';
import { KnowledgeMap } from '../../drawing-tool/services/interfaces';
import { EnrichmentTableCreateDialogComponent } from '../components/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from '../components/enrichment-table-edit-dialog.component';
import { PdfFile, UploadPayload, UploadType } from '../../interfaces/pdf-files.interface';
import { FileEditDialogComponent } from '../components/file-edit-dialog.component';
import { MapEditDialogComponent } from '../../drawing-tool/components/map-edit-dialog.component';
import { ObjectDeleteDialogComponent } from '../components/object-delete-dialog.component';
import { PdfFilesService } from '../../shared/services/pdf-files.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { ProjectPageService } from './project-page.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { MapService } from '../../drawing-tool/services';
import { BehaviorSubject, combineLatest, from, Observable, throwError } from 'rxjs';
import { Progress, ProgressMode } from '../../interfaces/common-dialog.interface';
import { catchError, finalize, map, mergeMap, tap } from 'rxjs/operators';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { ObjectDeletionResultDialogComponent } from '../components/object-deletion-result-dialog.component';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { FilesystemObject } from '../models/filesystem-object';
import { cloneDeep } from 'lodash';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { DefaultMap } from '../../shared/utils/collections';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { FileSelectionDialogComponent } from '../components/dialog/file-selection-dialog.component';
import { FileAnnotationHistoryDialogComponent } from '../components/dialog/file-annotation-history-dialog.component';

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
              private readonly mapService: MapService,
              private readonly ngbModal: NgbModal,
              private readonly messageDialog: MessageDialog,
              private readonly errorHandler: ErrorHandler) {
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

  openDirectoryCreateDialog(parent: FilesystemObject): Promise<any> {
    const dialogRef = this.ngbModal.open(DirectoryEditDialogComponent);
    return dialogRef.result.then((resp: Directory) => {
      const progressDialogRef = this.createProgressDialog('Creating folder...');

      return this.projectPageService.createDirectory(
          parent.locator.projectName,
          parent.directory.id,
          resp.name,
      )
          .pipe(
              this.errorHandler.create(),
              finalize(() => progressDialogRef.close()),
          )
          .toPromise();
    });
  }


  openMapCreateDialog(parent?: FilesystemObject,
                      options: Partial<MapCreateOptions> = {}): Promise<{
    project: KnowledgeMap
  }> {
    if (parent != null) {
      const dialogRef = this.modalService.open(MapCreateDialogComponent);
      dialogRef.componentInstance.filename = options.filename;
      return dialogRef.result.then((newMap: KnowledgeMap) => {
        const progressDialogRef = this.createProgressDialog('Creating map...');

        return this.mapService.createMap(
          parent.locator.projectName,
          parent.directory.id,
          newMap.label,
          newMap.description,
          newMap.public,
        )
          .pipe(
            this.errorHandler.create(),
            finalize(() => progressDialogRef.close()),
          )
          .toPromise();
      });
    } else {
      const dialogRef = this.modalService.open(FileSelectionDialogComponent);
      dialogRef.componentInstance.title = `Select Folder for New Map`;
      dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
      dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => {
        return o.type === 'dir';
      };
      return dialogRef.result.then((destinations: FilesystemObject[]) => {
        const destination = destinations[0];
        const progressDialogRef = this.createProgressDialog('Creating map...');

        return this.mapService.createMap(
          destination.locator.projectName,
          parseInt(destination.locator.directoryId, 10),
          'Untitled',
          '',
          false,
        )
          .pipe(
            this.errorHandler.create(),
            finalize(() => progressDialogRef.close()),
          )
          .toPromise();
      });
    }
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

  openUploadDialog(parent: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(ObjectUploadDialogComponent);
    dialogRef.componentInstance.directoryId = parent.directory.id;
    return dialogRef.result.then(data => this.upload(parent, data));
  }

  openShareDialog(object: FilesystemObject): Promise<any> {
    const modalRef = this.modalService.open(ShareDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/projects/`
        + `${object.locator.projectName}` + (object.locator.directoryId ?
            `/folders/${object.locator.directoryId}` : '')
        + '?fromWorkspace';
    return modalRef.result;
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

  openMoveDialog(target: FilesystemObject): Promise<any> {
    if (target.type === 'map' || target.type === 'file') {
      const dialogRef = this.modalService.open(FileSelectionDialogComponent);
      dialogRef.componentInstance.title = `Move '${target.name}'`;
      dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
      dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => {
        return o.type === 'dir';
      };
      return dialogRef.result.then((destinations: FilesystemObject[]) => {
        const destination = destinations[0];

        const progressDialogRef = this.createProgressDialog('Moving item...');

        if (target.type === 'file') {
          return this.filesService.moveFile(
              target.locator.projectName,
              (target.data as PdfFile).file_id,
              parseInt(destination.locator.directoryId, 10),
          )
              .pipe(
                  this.errorHandler.create(),
                  finalize(() => progressDialogRef.close()),
              )
              .toPromise();
        } else if (target.type === 'map') {
          return this.mapService.moveMap(
              target.locator.projectName,
              (target.data as KnowledgeMap).hash_id,
              parseInt(destination.locator.directoryId, 10),
          )
              .pipe(
                  this.errorHandler.create(),
                  finalize(() => progressDialogRef.close()),
              )
              .toPromise();
        } else {
          progressDialogRef.close();
          throw new Error('unknown type of file for moving');
        }
      });
    } else {
      this.messageDialog.display({
        title: 'Unable to be Moved',
        message: 'This cannot be moved yet.',
        type: MessageType.Warning,
      });
      return Promise.reject();
    }
  }

  openEditDialog(target: FilesystemObject): Promise<any> {
    if (target.type === 'dir') {
      const dialogRef = this.ngbModal.open(DirectoryEditDialogComponent);
      dialogRef.componentInstance.editing = true;
      dialogRef.componentInstance.directory = cloneDeep(target.data);
      return dialogRef.result.then((resp: Directory) => {
        const progressDialogRef = this.createProgressDialog('Renaming directory...');

        return this.projectPageService.renameDirectory(
            target.locator.projectName,
            (target.data as Directory).id,
            resp.name,
        )
            .pipe(
                this.errorHandler.create(),
                finalize(() => progressDialogRef.close()),
            )
            .toPromise();
      });
    } else if (target.type === 'file') {
      // We are using an outer promise because some of the code uses promises and some
      // use RxJs, but this is a bloody disaster
      return new Promise((accept, reject) => {
        const file = target.data as PdfFile;
        // This code was moved from another file
        // The following code doesn't show any progress or handle errors very well and
        // it should be fixed
        this.filesService.getFileFallbackOrganism(
            target.locator.projectName, file.file_id,
        ).pipe(
            this.errorHandler.create(),
            map(organismTaxId => {
              const dialogRef = this.modalService.open(FileEditDialogComponent);
              dialogRef.componentInstance.organism = organismTaxId;
              dialogRef.componentInstance.file = file;
              dialogRef.result.then(data => {
                if (data) {
                  const progressDialogRef = this.createProgressDialog('Saving changes...');

                  this.filesService.updateFileMeta(
                      target.locator.projectName,
                      file.file_id,
                      data.filename,
                      data.organism,
                      data.description,
                  )
                      .pipe(
                          this.errorHandler.create(),
                          finalize(() => progressDialogRef.close()),
                          tap(accept),
                          catchError(error => {
                            reject();
                            return throwError(error);
                          }),
                      )
                      .subscribe();
                } else {
                  reject();
                }
              });
            }),
            catchError(error => {
              reject();
              return throwError(error);
            }),
        ).subscribe();
      });
    } else if (target.type === 'map') {
      const dialogRef = this.modalService.open(MapEditDialogComponent);
      dialogRef.componentInstance.map = cloneDeep(target.data);
      return dialogRef.result.then(newMap => {
        const progressDialogRef = this.createProgressDialog('Saving changes...');

        return this.mapService.updateMap(target.locator.projectName, newMap)
            .pipe(
                this.errorHandler.create(),
                finalize(() => progressDialogRef.close()),
            )
            .toPromise();
      });
    } else {
      throw new Error(`unsupported type: ${target.type}`);
    }
  }

  openDeleteDialog(objects: readonly FilesystemObject[]): Promise<any> {
    const dialogRef = this.modalService.open(ObjectDeleteDialogComponent);
    dialogRef.componentInstance.objects = objects;
    return dialogRef.result.then(() => {
      return this.delete(objects);
    });
  }

  openFileAnnotationHistoryDialog(object: FilesystemObject): Promise<any> {
    const dialogRef = this.modalService.open(FileAnnotationHistoryDialogComponent, {
      size: 'lg',
    });
    dialogRef.componentInstance.object = object;
    return dialogRef.result;
  }

  // ========================================
  // Actions
  // ========================================

  upload(parent: FilesystemObject, data: UploadPayload): Promise<any> {
    // Let's show some progress!
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing file for upload...',
    }));
    const name = data.type === UploadType.Files ? data.files[0].name : 'file';
    const progressDialogRef = this.progressDialog.display({
      title: `Adding ${name}...`,
      progressObservable,
    });

    return this.filesService.uploadFile(
        parent.locator.projectName,
        parent.locator.directoryId,
        data,
    )
        .pipe(
            map(res => res.file_id),
            mergeMap(fileId => this.filesService.annotateFile(
                parent.locator.projectName, fileId, data.annotationMethod, data.organism)),
        )
        .pipe(map(event => {
              if (event.type === HttpEventType.UploadProgress) {
                if (event.loaded >= event.total) {
                  progressObservable.next(new Progress({
                    mode: ProgressMode.Buffer,
                    status: 'Creating annotations in file...',
                    value: event.loaded / event.total,
                  }));
                } else {
                  progressObservable.next(new Progress({
                    mode: ProgressMode.Determinate,
                    status: 'Uploading file...',
                    value: event.loaded / event.total,
                  }));
                }
              } else if (event.type === HttpEventType.Response) {
                const body = event.body as any;
                this.snackBar.open(`File '${body.result.filenames}' uploaded`, 'Close', {duration: 5000});
              }
            },
            err => {
              return throwError(err);
            },
        ))
        .pipe(
            this.errorHandler.create(),
            finalize(() => {
              progressDialogRef.close();
            }))
        .toPromise();
  }

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
          this.errorHandler.create(),
          finalize(() => {
            progressDialogRef.close();
          }),
      ).toPromise();
    } else {
      this.messageDialog.display({
        title: 'Nothing to Re-annotate',
        message: 'No files were selected to re-annotate.',
        type: MessageType.Warning,
      });
    }
  }

  delete(objects: readonly FilesystemObject[]): Promise<any> {
    const failed: { object: DirectoryObject, message: string }[] = [];
    const progressDialogRef = this.createProgressDialog('Deleting...');

    return combineLatest(
        objects.map(object => this.deleteObject(object).pipe(
            catchError(error => {
              if (error instanceof DeletionError) {
                failed.push({
                  object,
                  message: error.message,
                });
                return from([object]);
              } else {
                return throwError(error);
              }
            }),
        )))
        .pipe(
            this.errorHandler.create(),
            tap(() => {
              if (failed.length) {
                const dialogRef = this.modalService.open(ObjectDeletionResultDialogComponent);
                dialogRef.componentInstance.failed = failed;
              } else {
                this.snackBar.open(`Deletion completed.`, 'Close', {duration: 5000});
              }
            }),
        )
        .pipe(
            finalize(() => progressDialogRef.close())
        )
        .toPromise();
  }

  private deleteObject(object: FilesystemObject): Observable<any> {
    switch (object.type) {
      case 'map':
        const hashId = (object.data as KnowledgeMap).hash_id;
        return this.mapService.deleteMap(
            object.locator.projectName,
            hashId,
        );
      case 'file':
        const fileId = (object.data as PdfFile).file_id;

        return this.filesService.deleteFile(
            object.locator.projectName,
            fileId,
        );
      case 'dir':
        const dirId = (object.data as Directory).id;

        return this.projectPageService.deleteDirectory(
            object.locator.projectName,
            dirId,
        ).pipe(
            catchError((error: HttpErrorResponse) => {
              if (error.status === 400 && error.error.apiHttpError && error.error.apiHttpError.name === 'Directory Error') {
                return throwError(new DeletionError('Directory is not empty and cannot be deleted'));
              } else {
                return throwError(error);
              }
            }),
        );
      default:
        throw new Error(`unknown directory object type: ${object.type}`);
    }
  }
}

class DeletionError {
  constructor(readonly message: string) {
  }
}

export class MapCreateOptions {
  filename?: string;
}
