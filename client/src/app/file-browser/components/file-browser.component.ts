import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, combineLatest, from, Observable, Subscription, throwError } from 'rxjs';
import { mergeMap, map } from 'rxjs/operators';
import { PdfFile, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ObjectDeleteDialogComponent } from './object-delete-dialog.component';
import { ObjectUploadDialogComponent } from './object-upload-dialog.component';
import { FileEditDialogComponent } from './file-edit-dialog.component';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { Directory, ProjectSpaceService } from '../services/project-space.service';
import { ProjectPageService } from '../services/project-page.service';
import { DirectoryEditDialogComponent } from './directory-edit-dialog.component';
import { DirectoryContent, DirectoryObject } from '../../interfaces/projects.interface';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { MapEditDialogComponent } from '../../drawing-tool/components/map-edit-dialog.component';
import { MapService } from '../../drawing-tool/services';
import { cloneDeep } from 'lodash';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { MapCreateDialogComponent } from '../../drawing-tool/components/map-create-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ModuleProperties } from '../../shared/modules';
import { KnowledgeMap, UniversalGraphNode } from '../../drawing-tool/services/interfaces';
import { catchError } from 'rxjs/operators';
import { ObjectDeletionResultDialogComponent } from './object-deletion-result-dialog.component';
import { getLink } from '../../search/utils/records';
import { getObjectCommands } from '../utils/objects';

interface PathLocator {
  projectName?: string;
  directoryId?: string;
}

interface AnnotatedDirectoryObject extends DirectoryObject {
  annotationsTooltipContent?: string;
}

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  loadTask: BackgroundTask<PathLocator, DirectoryContent>;
  loadTaskSubscription: Subscription;
  paramsSubscription: Subscription;

  locator: PathLocator;
  directory: Directory;
  path: Directory[];
  readonly results = new CollectionModal<AnnotatedDirectoryObject>([], {
    multipleSelection: true,
    sort: (a: AnnotatedDirectoryObject, b: AnnotatedDirectoryObject) => {
      if (a.type === 'dir' && b.type !== 'dir') {
        return -1;
      } else if (a.type !== 'dir' && b.type === 'dir') {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    },
  });

  lmdbsDates = {};

  constructor(private readonly filesService: PdfFilesService,
              private readonly router: Router,
              private readonly snackBar: MatSnackBar,
              private readonly modalService: NgbModal,
              private readonly progressDialog: ProgressDialog,
              private readonly errorHandler: ErrorHandler,
              private readonly route: ActivatedRoute,
              private readonly projectSpaceService: ProjectSpaceService,
              private readonly projectPageService: ProjectPageService,
              private readonly workspaceManager: WorkspaceManager,
              private readonly mapService: MapService,
              private readonly ngbModal: NgbModal,
              private readonly messageDialog: MessageDialog) {
  }

  ngOnInit() {
    this.filesService.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates = lmdbsDates;
      this.updateAnnotationsStatus(this.results.items);
    });

    this.loadTask = new BackgroundTask(
      (locator: PathLocator) => this.projectPageService.getDirectory(
        locator.projectName,
        locator.directoryId,
      ),
    );

    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result}) => {
      this.directory = result.dir;
      this.path = result.path;
      const objects = result.objects;
      this.updateAnnotationsStatus(objects);
      this.results.replace(objects);

      this.modulePropertiesChange.emit({
        title: this.locator.projectName + (this.path.length > 1 ? ' - ' + this.directory.name : ''),
        fontAwesomeIcon: 'layer-group',
      });
    });

    this.paramsSubscription = this.route.params.subscribe(params => {
      this.locator = {
        projectName: params.project_name,
        directoryId: params.dir_id,
      };

      this.modulePropertiesChange.emit({
        title: this.locator.projectName,
        fontAwesomeIcon: 'layer-group',
      });

      this.loadTask.update(this.locator);
    });
  }

  ngOnDestroy(): void {
    this.paramsSubscription.unsubscribe();
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.locator);
  }

  private updateAnnotationsStatus(objects: readonly AnnotatedDirectoryObject[]) {
    objects.forEach((object: AnnotatedDirectoryObject) => {
      if (object.type === 'file') {
        const file = object.data as PdfFile;
        object.annotationsTooltipContent = this.generateTooltipContent(file);
      }
    });
  }

  private generateTooltipContent(file): string {
    const outdated = Array
      .from(Object.entries(this.lmdbsDates))
      .filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotationsDate));
    if (outdated.length === 0) {
      return '';
    }
    return outdated.reduce(
      (tooltip: string, [name, date]: [string, string]) => `${tooltip}\n- ${name}, ${new Date(date).toDateString()}`,
      'Outdated:',
    );
  }

  private normalizeFilter(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  applyFilter(filter: string) {
    const normalizedFilter = this.normalizeFilter(filter);
    this.results.filter = normalizedFilter.length ? (item: AnnotatedDirectoryObject) => {
      return this.normalizeFilter(item.name).includes(normalizedFilter);
    } : null;
  }

  // ========================================
  // Dialogs
  // ========================================

  displayUploadDialog() {
    const dialogRef = this.modalService.open(ObjectUploadDialogComponent);
    dialogRef.result.then(data => {
      this.upload(data);
    }, () => {
    });
  }

  displayDirectoryCreateDialog() {
    const dialogRef = this.ngbModal.open(DirectoryEditDialogComponent);
    dialogRef.result.then(
      (resp: Directory) => {
        this.projectPageService.createDirectory(
          this.locator.projectName,
          this.directory.id,
          resp.name,
        )
          .pipe(this.errorHandler.create())
          .subscribe(() => {
            this.refresh();
            this.snackBar.open(`Folder '${resp.name}' created`, 'Close', {duration: 5000});
          });
      },
      () => {
      },
    );
  }

  displayMapCreateDialog() {
    const dialogRef = this.modalService.open(MapCreateDialogComponent);
    dialogRef.result.then((newMap: KnowledgeMap) => {
      this.mapService.createMap(
        this.locator.projectName,
        this.directory.id,
        newMap.label,
        newMap.description,
        newMap.public,
      )
        .pipe(this.errorHandler.create())
        .subscribe((result) => {
          this.refresh();
          this.workspaceManager.navigate(['/projects', this.locator.projectName, 'maps', result.project.hash_id, 'edit'], {
            newTab: true,
            queryParams: this.getObjectQueryParams(),
          });
          this.snackBar.open(`Map '${newMap.label}' created, opening...`, 'Close', {duration: 5000});
        });
    });
  }

  displayEditDialog(object: AnnotatedDirectoryObject) {
    if (object.type === 'dir') {
      const dialogRef = this.ngbModal.open(DirectoryEditDialogComponent);
      dialogRef.componentInstance.editing = true;
      dialogRef.componentInstance.directory = cloneDeep(object.data);
      dialogRef.result.then(
        (resp: Directory) => {
          this.projectPageService.renameDirectory(
            this.locator.projectName,
            (object.data as Directory).id,
            resp.name,
          )
            .pipe(this.errorHandler.create())
            .subscribe(() => {
              this.refresh();
              this.snackBar.open(`Folder '${object.name}' renamed to '${resp.name}'`, 'Close', {duration: 5000});
            });
        },
        () => {
        },
      );
    } else if (object.type === 'file') {
      const file = object.data as PdfFile;
      const dialogRef = this.modalService.open(FileEditDialogComponent);
      dialogRef.componentInstance.file = file;
      dialogRef.result.then(data => {
        if (data) {
          this.filesService.updateFileMeta(
            this.locator.projectName,
            file.file_id,
            data.filename,
            data.description,
          )
            .pipe(this.errorHandler.create())
            .subscribe(() => {
              this.refresh();
              this.snackBar.open(`File details updated`, 'Close', {duration: 5000});
            });
        }
      }, () => {
      });
    } else if (object.type === 'map') {
      const dialogRef = this.modalService.open(MapEditDialogComponent);
      dialogRef.componentInstance.map = cloneDeep(object.data);
      dialogRef.result.then(newMap => {
        this.mapService.updateMap(this.locator.projectName, newMap)
          .pipe(this.errorHandler.create())
          .subscribe(() => {
            this.refresh();
            this.snackBar.open(`Map details updated`, 'Close', {duration: 5000});
          });
      }, () => {
      });
    } else {
      throw new Error(`unsupported type: ${object.type}`);
    }
  }

  displayDeleteDialog(objects: readonly AnnotatedDirectoryObject[]) {
    const dialogRef = this.modalService.open(ObjectDeleteDialogComponent);
    dialogRef.componentInstance.objects = objects;
    dialogRef.result.then(() => {
      this.delete(objects);
    }, () => {
    });
  }

  // ========================================
  // Actions
  // ========================================

  upload(data: UploadPayload) {
    // Let's show some progress!
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing file for upload...',
    }));
    const name = data.type === UploadType.Files ? data.files[0].name : 'file';
    const progressDialogRef = this.progressDialog.display({
      title: `Adding ${name}...`,
      progressObservable,
    });

    this.filesService.uploadFile(
      this.locator.projectName,
      this.directory.id,
      data,
    )
      .pipe(
        map(res => res.file_id),
        mergeMap(fileId => this.filesService.annotateFile(
          this.locator.projectName, fileId, data.annotationMethod))
      )
      .pipe(this.errorHandler.create())
      .subscribe(event => {
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
            progressDialogRef.close();
            const body = event.body as any;
            this.snackBar.open(`File '${body.result.filenames}' uploaded`, 'Close', {duration: 5000});
            this.refresh(); // updates the list on successful upload
          }
        },
        err => {
          progressDialogRef.close();
          this.refresh();
          return throwError(err);
        },
      );
  }

  reannotate(objects: readonly AnnotatedDirectoryObject[]) {
    const files: PdfFile[] = objects
      .filter(object => object.type === 'file')
      .map(file => file.data as PdfFile);

    if (files.length) {
      const ids: string[] = files.map((file: PdfFile) => file.file_id);
      // Let's show some progress`!
      const progressObservable = new BehaviorSubject<Progress>(new Progress({
        status: 'Re-creating annotations in file...',
        mode: ProgressMode.Buffer,
      }));
      const progressDialogRef = this.progressDialog.display({
        title: `Reannotating file${files.length === 1 ? '' : 's'}...`,
        progressObservable,
      });
      this.filesService.reannotateFiles(this.locator.projectName, ids).pipe(this.errorHandler.create()).subscribe(
        (res) => {
          this.refresh();
          this.snackBar.open(`Reannotation completed`, 'Close', {duration: 5000});
          progressDialogRef.close();
        },
        err => {
          this.refresh();
          this.snackBar.open(`Reannotation failed`, 'Close', {duration: 10000});
          progressDialogRef.close();
        },
      );
    } else {
      this.messageDialog.display({
        title: 'Nothing to Re-annotate',
        message: 'No files were selected to re-annotate.',
        type: MessageType.Warning,
      });
    }
  }

  delete(objects: readonly AnnotatedDirectoryObject[]) {
    const failed: { object: DirectoryObject, message: string }[] = [];

    combineLatest(
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
      .pipe(this.errorHandler.create())
      .subscribe(() => {
        this.refresh();

        if (failed.length) {
          const dialogRef = this.modalService.open(ObjectDeletionResultDialogComponent);
          dialogRef.componentInstance.failed = failed;
        } else {
          this.snackBar.open(`Deletion completed`, 'Close', {duration: 5000});
        }
      })
    ;
  }

  private deleteObject(object: AnnotatedDirectoryObject): Observable<any> {
    switch (object.type) {
      case 'map':
        const hashId = (object.data as KnowledgeMap).hash_id;
        return this.mapService.deleteMap(
          this.locator.projectName,
          hashId,
        );
      case 'file':
        const fileId = (object.data as PdfFile).file_id;

        return this.filesService.deleteFile(
          this.locator.projectName,
          fileId,
        );
      case 'dir':
        const dirId = (object.data as Directory).id;

        return this.projectPageService.deleteDirectory(
          this.locator.projectName,
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

  getObjectCommands(object: AnnotatedDirectoryObject): any[] {
    return getObjectCommands(object);
  }

  getObjectQueryParams() {
    if (this.router.url === this.workspaceManager.workspaceUrl) {
      return {};
    } else {
      return {
        return: `/projects/${encodeURIComponent(this.locator.projectName)}`
          + (this.locator.directoryId ? `/folders/${this.locator.directoryId}` : ''),
      };
    }
  }

  dragStarted(event: DragEvent, object: AnnotatedDirectoryObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', object.name);
    dataTransfer.setData('application/***ARANGO_DB_NAME***-node', JSON.stringify({
      display_name: object.name,
      label: object.type === 'map' ? 'map' : 'link',
      sub_labels: [],
      data: {
        source: this.getObjectCommands(object).join('/'),
      },
    } as Partial<UniversalGraphNode>));
  }

  goUp() {
    if (this.path != null) {
      if (this.path.length > 2) {
        this.workspaceManager.navigate(
          ['/projects', this.locator.projectName, 'folders', this.path[this.path.length - 2].id]
        );
      } else if (this.path.length === 2) {
          this.workspaceManager.navigate(
            ['/projects', this.locator.projectName]
          );
      } else {
        this.workspaceManager.navigate(['/projects']);
      }
    }
  }
}

class DeletionError {
  constructor(readonly message: string) {
  }
}
