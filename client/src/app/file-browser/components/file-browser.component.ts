import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, combineLatest, Observable, Subscription, throwError } from 'rxjs';
import { PdfFile, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HttpEventType } from '@angular/common/http';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ObjectDeleteDialogComponent } from './object-delete-dialog.component';
import { ObjectUploadDialogComponent } from './object-upload-dialog.component';
import { FileEditDialogComponent } from './file-edit-dialog.component';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { Directory, Map, ProjectSpaceService } from '../services/project-space.service';
import { ProjectPageService } from '../services/project-page.service';
import { DirectoryCreateDialogComponent } from './directory-create-dialog.component';
import { DirectoryContent, DirectoryObject } from '../../interfaces/projects.interface';
import { CollectionModal } from '../../shared/utils/collection-modal';
import { MapEditDialogComponent } from '../../drawing-tool/components/map-edit-dialog.component';
import { ProjectsService } from '../../drawing-tool/services';
import { cloneDeep } from 'lodash';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { MapCreateDialogComponent } from '../../drawing-tool/components/map-create-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ModuleProperties } from '../../shared/modules';

export interface File extends PdfFile {
  // Camel-case instead of snake-case version of file
  fileId?: string;
  // TODO: wtf we need to fix this
}

interface PathLocator {
  projectName?: string;
  directoryId?: string;
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
  readonly results = new CollectionModal<DirectoryObject>([], {
    multipleSelection: true,
    sort: (a: DirectoryObject, b: DirectoryObject) => {
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
              private readonly projectService: ProjectsService,
              private readonly ngbModal: NgbModal,
              private readonly messageDialog: MessageDialog) {
  }

  ngOnInit() {
    this.filesService.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates = lmdbsDates;
      // this.updateAnnotationsStatus(this.results.items);
    });

    this.loadTask = new BackgroundTask(
      (locator: PathLocator) => this.projectPageService.getProjectDir(
        locator.projectName,
        locator.directoryId,
      ).pipe(this.errorHandler.create()),
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
        loading: true,
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

  private updateAnnotationsStatus(objects: readonly DirectoryObject[]) {
    objects.forEach((object: DirectoryObject) => {
      if (object.type === 'file') {
        const file = object.data as File; // TODO: does this work?
        file.annotations_date_tooltip = this.generateTooltipContent(file);
      }
    });
  }

  private generateTooltipContent(file: File): string {
    const outdated = Array
      .from(Object.entries(this.lmdbsDates))
      .filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotations_date));
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
    this.results.filter = normalizedFilter.length ? (item: DirectoryObject) => {
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
    const dialogRef = this.ngbModal.open(DirectoryCreateDialogComponent);
    dialogRef.result.then(
      resp => {
        this.projectPageService.addDir(
          this.locator.projectName,
          this.directory.id,
          resp.name,
        )
          .pipe(this.errorHandler.create())
          .subscribe(() => {
            this.refresh();
          });
      },
      () => {
      },
    );
  }

  displayMapCreateDialog() {
    const dialogRef = this.modalService.open(MapCreateDialogComponent);
    dialogRef.result.then(newMap => {
      this.projectPageService.addMap(
        this.locator.projectName,
        this.directory.id,
        newMap.label,
        newMap.description,
        // TODO: public flag lost!!
      )
        .pipe(this.errorHandler.create())
        .subscribe((result) => {
          this.refresh();
          this.workspaceManager.navigate(['/maps', result.project.hash_id, 'edit'], {
            newTab: true,
          });
        });
    });
  }

  displayEditDialog(object: DirectoryObject) {
    if (object.type === 'dir') {
      this.messageDialog.display({
        title: 'Not Yet Implemented',
        message: 'Directories cannot yet be edited. Sorry.',
        type: MessageType.Warning,
      });
    } else if (object.type === 'file') {
      const file = object.data as File;
      const dialogRef = this.modalService.open(FileEditDialogComponent);
      dialogRef.componentInstance.file = file;
      dialogRef.result.then(data => {
        if (data) {
          this.projectPageService.updateFile(
            this.locator.projectName,
            file.fileId,
            data.filename,
            data.description,
          )
            .pipe(this.errorHandler.create())
            .subscribe(() => {
              this.refresh();
            });
        }
      }, () => {
      });
    } else if (object.type === 'map') {
      const dialogRef = this.modalService.open(MapEditDialogComponent);
      dialogRef.componentInstance.map = cloneDeep(object.data);
      dialogRef.result.then(newMap => {
        this.projectService.updateProject(newMap)
          .pipe(this.errorHandler.create())
          .subscribe(() => {
            this.refresh();
          });
      }, () => {
      });
    } else {
      throw new Error(`unsupported type: ${object.type}`);
    }
  }

  displayDeleteDialog(objects: readonly DirectoryObject[]) {
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

    this.projectPageService.addPdf(
      this.locator.projectName,
      this.directory.id,
      data,
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
            this.snackBar.open(`File uploaded: ${event.body.filename}`, 'Close', {duration: 5000});
            this.refresh(); // updates the list on successful upload
          }
        },
        err => {
          progressDialogRef.close();
          return throwError(err);
        },
      );
  }

  reannotate(objects: readonly DirectoryObject[]) {
    const files: File[] = objects
      .filter(object => object.type === 'file')
      .map(file => file.data as File);

    if (files.length) {
      const ids: string[] = files.map((file: File) => file.fileId);
      // Let's show some progress`!
      const progressObservable = new BehaviorSubject<Progress>(new Progress({
        status: 'Re-creating annotations in file...',
        mode: ProgressMode.Buffer,
      }));
      const progressDialogRef = this.progressDialog.display({
        title: `Reannotating file${files.length === 1 ? '' : 's'}...`,
        progressObservable,
      });
      this.filesService.reannotateFiles(ids).pipe(this.errorHandler.create()).subscribe(
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

  delete(objects: readonly DirectoryObject[]) {
    // TODO: not being able to delete directory is super lame
    const supportedObjects = objects.filter(object => object.type !== 'dir');

    if (supportedObjects.length) {
      combineLatest(supportedObjects.map(object => this.deleteObject(object)))
        .pipe(this.errorHandler.create())
        .subscribe(() => {
          this.refresh();

          this.snackBar.open(`Deletion completed`, 'Close', {duration: 5000});

          if (supportedObjects.length !== objects.length) {
            this.messageDialog.display({
              title: 'Some Items Not Deleted',
              message: 'Everything but the selected folders were deleted. You cannot delete folders yet.',
              type: MessageType.Warning,
            });
          }
        });
    } else {
      this.messageDialog.display({
        title: 'Some Items Not Deleted',
        message: 'Folders cannot yet be deleted. Sorry.',
        type: MessageType.Warning,
      });
    }
  }

  private deleteObject(object: DirectoryObject): Observable<any> {
    switch (object.type) {
      case 'map':
        const hashId = (object.data as Map).hashId;
        return this.projectPageService.deleteMap(
          this.locator.projectName,
          hashId,
        );
      case 'file':
        const fileId = (object.data as File).fileId;

        return this.projectPageService.deletePDF(
          this.locator.projectName,
          fileId,
        );
      case 'dir':
        throw new Error('not implemented');
      default:
        throw new Error(`unknown directory object type: ${object.type}`);
    }
  }

  getObjectCommands(object: DirectoryObject): any[] {
    switch (object.type) {
      case 'dir':
        const directory = object.data as Directory;
        // TODO: Convert to hash ID
        return ['/projects', this.locator.projectName, 'folders', directory.id];
      case 'file':
        const file = object.data as File;
        return ['/projects', this.locator.projectName, 'files', file.fileId];
      case 'map':
        const map = object.data as Map;
        return ['/maps', map.hashId, 'edit'];
      default:
        throw new Error(`unknown directory object type: ${object.type}`);
    }
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
}

