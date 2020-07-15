import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subscription, throwError, } from 'rxjs';
import { PdfFile, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HttpEventType } from '@angular/common/http';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileDeleteDialogComponent } from './file-delete-dialog.component';
import { FileUploadDialogComponent } from './file-upload-dialog.component';
import { FileEditDialogComponent } from './file-edit-dialog.component';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { Directory, Map, ProjectSpaceService, Project } from '../services/project-space.service';
import { ProjectPageService } from '../services/project-page.service';
import { isNullOrUndefined } from 'util';
import { AddContentDialogComponent } from './add-content-dialog/add-content-dialog.component';

export interface File extends PdfFile {
  type: string;
  // Camel-case instead of snake-case version of file
  fileId?: string;
}

interface DirectoryArgument {
  projectName?: string;
  directoryId?: string;
}
export interface DirectoryContent {
  files: File[];
  maps: Map[];
  childDirectories: Directory[];
}

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  files: File[] = [];
  shownFiles: File[] = [];
  isReannotating = false;
  uploadStarted = false;
  lmdbsDates = {};

  loadTask: BackgroundTask<DirectoryArgument, DirectoryContent> = new BackgroundTask(
    (dirArg: DirectoryArgument) => this.projPage.getProjectDir(
      dirArg.projectName, dirArg.directoryId
    )
  );
  loadTaskSubscription: Subscription;

  // The project to pull content out of
  projectName = '';

  // The current directory we're residing in
  currentDirectoryId;
  currentDirectoryName = '';

  // The directory path from parent
  dirPathChain: string[] = [];
  dirPathId: number[] = [];

  // Query to filter files by
  filterQuery = '';
  // The list of files filtered by query
  showFileCollection: (Directory|Map|File)[] = [];

  // The list of files in a directory
  FILE_COLLECTION: (Directory|Map|File)[] = [];
  get fileCollection(): (Directory|Map|File)[] {
    return this.FILE_COLLECTION;
  }
  set fileCollection(val: (Directory|Map|File)[]) {
    this.FILE_COLLECTION = val;
    this.showFileCollection = val;
  }

  // Which files are selected to do action on
  selection = new SelectionModel<(Directory|Map|File)>(true, []);

  fileSpaceSubscription: Subscription;

  get amIRootDir() {
    return this.dirPathChain.length === 0;
  }

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
    private readonly modalService: NgbModal,
    private progressDialog: ProgressDialog,
    private readonly errorHandler: ErrorHandler,
    private route: ActivatedRoute,
    private projSpace: ProjectSpaceService,
    private projPage: ProjectPageService,
    private ngbModal: NgbModal
  ) {
    if (this.route.snapshot.params.project_name) {
      this.projectName = this.route.snapshot.params.project_name;

      this.fileSpaceSubscription = this.route.queryParams
        .subscribe(resp => {
          if (isNullOrUndefined(resp)) { return; }

          const {
            dir, id
          } = resp;

          // If an array .. override directory chain with
          // those from url parameters
          if (
            Array.isArray(dir) &&
            Array.isArray(id)
          ) {
            this.dirPathChain = dir;
            this.dirPathId = id;
          } else {
            if (!isNullOrUndefined(dir) && !isNullOrUndefined(id)) {
              this.dirPathChain = [dir];
              // tslint:disable-next-line: radix
              this.dirPathId = [parseInt(id)];
            } else {
              // Reset back to root directory
              this.dirPathChain = [];
              this.dirPathId = [];
            }
          }

          // If not empty, pull content from current dir id
          if (this.dirPathChain.length && this.dirPathId.length) {
            // Pull Content form subdir
            this.currentDirectoryId = this.dirPathId.slice(-1)[0];
            this.currentDirectoryName = this.dirPathChain.slice(-1)[0];

            this.loadTask.update({
                projectName: this.projectName,
                directoryId: this.currentDirectoryId
              });
          } else {
            // Else pull Content from root
            this.projSpace.getProject(this.projectName)
              .subscribe(
                (p: Project) => {
                  this.currentDirectoryId = p.directory.projectsId;
                }
              );
            this.loadTask.update({
                projectName: this.projectName,
                directoryId: null
              });
          }
        }
      );
    }
  }

  ngOnInit() {
    this.pdf.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates = lmdbsDates;
      this.updateAnnotationsStatus(this.files);
    });
    this.loadTaskSubscription = this.loadTask.results$.subscribe(
      (
        {
          result: dirContent,
        }
      ) => {
        this.processDirectoryContent(dirContent);

        // We assume that fetched files are correctly annotated
        // this.updateAnnotationsStatus(files);
        // this.updateFilter();
      },
    );

    this.refresh();
  }

  ngOnDestroy(): void {
    this.loadTaskSubscription.unsubscribe();
    this.fileSpaceSubscription.unsubscribe();
  }

  refresh() {
    this.selection.clear();
    this.loadTask.update({
      projectName: this.projectName,
      directoryId: this.amIRootDir ? null : this.currentDirectoryId
    });
  }

  isAllSelected(): boolean {
    if (!this.selection.selected.length) {
      return false;
    }
    for (const item of this.fileCollection) {
      if (!this.selection.isSelected(item)) {
        return false;
      }
    }
    return true;
  }

  toggleAllSelected(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.fileCollection);
    }
  }

  /**
   * Get selected files that are also shown.
   */
  getSelectedShownFiles() {
    const result = [];
    for (const item of this.fileCollection) {
      if (this.selection.isSelected(item)) {
        result.push(item);
      }
    }
    return result;
  }

  upload(data: UploadPayload) {
    // The user shouldn't be able to initiate a new file upload
    if (this.uploadStarted) {
      return;
    }
    this.uploadStarted = true;

    // Let's show some progress!
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing file for upload...',
    }));
    const name = data.type === UploadType.Files ? data.files[0].name : 'file';
    const progressDialogRef = this.progressDialog.display({
      title: `Adding ${name}...`,
      progressObservable,
    });

    this.projPage.addPdf(
      this.projectName,
      this.currentDirectoryId,
      data
    ).pipe(this.errorHandler.create()).subscribe(event => {
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
          this.uploadStarted = false;
          this.snackBar.open(`File uploaded: ${event.body.filename}`, 'Close', {duration: 5000});
          this.refresh(); // updates the list on successful upload
        }
      },
      err => {
        progressDialogRef.close();
        this.uploadStarted = false;
        return throwError(err);
      },
    );
  }

  deleteFiles(files) {
    const ids: string[] = files.map((file: File) => file.file_id);
    this.pdf.deleteFiles(ids).pipe(this.errorHandler.create()).subscribe(
      (res) => {
        let msg = 'Deletion completed';
        if (Object.values(res).includes('Not an owner')) { // check if any file was not owned by the current user
          msg = `${msg}, but one or more files could not be deleted because you are not the owner`;
        }
        this.snackBar.open(msg, 'Close', {duration: 10000});
        this.refresh(); // updates the list on successful deletion
        console.log('deletion result', res);
      },
      err => {
        this.snackBar.open(`Deletion failed`, 'Close', {duration: 10000});
        console.error('deletion error', err);
      },
    );
  }

  reannotate() {
    this.isReannotating = true;
    const ids: string[] = this.selection.selected.map((file: File) => file.file_id);
    // Let's show some progress!
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Re-creating annotations in file...',
      mode: ProgressMode.Buffer,
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Reannotating file${this.selection.selected.length === 1 ? '' : 's'}...`,
      progressObservable,
    });
    this.pdf.reannotateFiles(ids).pipe(this.errorHandler.create()).subscribe(
      (res) => {
        this.refresh();
        this.isReannotating = false;
        this.snackBar.open(`Reannotation completed`, 'Close', {duration: 5000});
        progressDialogRef.close();
      },
      err => {
        this.refresh();
        this.isReannotating = false;
        this.snackBar.open(`Reannotation failed`, 'Close', {duration: 10000});
        progressDialogRef.close();
      },
    );
  }

  applyFilter(query: string) {
    this.filterQuery = query.trim();
    this.updateFilter();
  }

  private updateFilter() {
    this.showFileCollection = this.filterQuery.length ?
      this.fileCollection.filter(
        (f: ( Map|File|Directory)) => {
          switch (f.type) {
            case 'pdf':
              return (f as File).filename.includes(this.filterQuery);
            case 'map':
              return (f as Map).label.includes(this.filterQuery);
            case 'dir':
              return (f as Directory).name.includes(this.filterQuery);
            default:
              return false;
          }
        }
      ) :
      this.fileCollection;
  }

  displayUploadDialog() {
    const dialogRef = this.modalService.open(FileUploadDialogComponent);
    dialogRef.result.then(data => {
      this.upload(data);
    }, () => {
    });
  }

  displayEditDialog(file: File = null) {
    if (file == null) {
      const selected = this.getSelectedShownFiles();
      if (selected.length === 1) {
        file = selected[0];
      } else {
        return null;
      }
    }
    const dialogRef = this.modalService.open(FileEditDialogComponent);
    dialogRef.componentInstance.file = file;
    dialogRef.result.then(data => {
      if (data) {
        this.pdf.updateFile(
          file.file_id,
          data.filename,
          data.description,
        ).subscribe(() => {
          this.refresh();
        });
      }
    }, () => {
    });
  }

  displayDeleteDialog() {
    const files = [...this.getSelectedShownFiles()];
    const dialogRef = this.modalService.open(FileDeleteDialogComponent);
    dialogRef.componentInstance.files = files;
    dialogRef.result.then(() => {
      files.map(f => this.delete(f));
    }, () => {
    });
  }

  private updateAnnotationsStatus(files: File[]) {
    files.forEach((file: File) => {
      file.annotations_date_tooltip = this.generateTooltipContent(file);
    });
    this.files = [...files];
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

  /**
   * Handle processing directory file content into
   * component variables
   * @param dirContent - the content for this project and directory
   */
  private processDirectoryContent(dirContent: DirectoryContent) {
    const content: {maps, childDirectories, files} = dirContent;

    let {
      maps,
      childDirectories,
      files
    } = content;

    maps = maps.map(
      (m: Map) => ({...m, type: 'map', routeLink: this.generateRouteLink(m, 'map')})
    );
    childDirectories = childDirectories.map(
      (d: Directory) => {
        const {
          name,
          id
        } = d;
        const dirs = [...this.dirPathChain, name];
        const ids = [...this.dirPathId, id];
        const dirPath = { dir: dirs, id: ids };
        return {dirPath, ...d, type: 'dir', routeLink: this.generateRouteLink(d, 'dir')};
      }
    );
    files = files.map(
      (f: File) => ({...f, type: 'pdf', routeLink: this.generateRouteLink(f, 'pdf')})
    );

    this.fileCollection = [].concat(maps, childDirectories, files);
  }

  // TODO - should I worry about default routing/testing for edit/read view
  /**
   * Construct a link to access that resource
   * @param file - either map, directory, or pdf
   * @param type - the type of it
   */
  private generateRouteLink(file: (Directory|Map), type) {
    switch (type) {
      case 'dir':
        return `/projects/${this.projectName}`;
      case 'map':
        const m: Map = file as Map;
        // TODO - bring in jsonify_with_class
        // tslint:disable-next-line: no-string-literal
        const hashId = m.hashId || m['hash_id'];
        return `/maps/${hashId}/edit`;
      case 'pdf':
        const f: File = file as File;
        const fileId = f.fileId;
        return `/files/${fileId}/${this.projectName}`;
      default:
        return '';
    }
  }

  /**
   * Construct a query param url from a javascript object
   * @param data - object
   */
  private encodeQueryData(data) {
    const ret = [];

    for (const d in data) {
      if (d in data) {
        (data[d] as any[]).forEach(param => {
          ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(param));
        });
      }
    }
    return ret.join('&');
 }

  /**
   * Navigate to a parent directory
   * @param index - idx of the parent directory in the directory chain
   */
  goUp(index) {
    const dirs = this.dirPathChain.slice(0, index + 1);
    const ids = this.dirPathId.slice(0, index + 1);

    this.fileCollection = [];

    if (dirs.length && ids.length) {
      // Go to sub directory
      this.router.navigate(
        [`/projects/${this.projectName}/`],
        { queryParams: { dir: dirs, id: ids } }
      );
    } else {
      // Go to project root
      this.router.navigateByUrl(
        `/projects/${this.projectName}`
      );
    }

  }

  /**
   * Go back to the project space
   */
  goBack() {
    this.router.navigateByUrl('projects');
  }

  /**
   * Add sub-directory in current directory
   */
  addDir() {
    const dialogRef = this.ngbModal.open(AddContentDialogComponent);
    dialogRef.componentInstance.mode = 'dir';

    dialogRef.result.then(
      resp => {
        this.projPage.addDir(
          this.projectName,
          this.currentDirectoryId,
          resp.dirname
        ).subscribe(
          (d: Directory) => {
            this.fileCollection = this.fileCollection.concat({
              ...d,
              type: 'dir',
              routeLink: this.generateRouteLink(d, 'dir')
            });
        });
      },
      () => {
      }
    );
  }

  /**
   * Add map in current directory
   */
  addMap() {
    const dialogRef = this.ngbModal.open(AddContentDialogComponent);
    dialogRef.componentInstance.mode = 'map';

    dialogRef.result.then(
      resp => {
        this.projPage.addMap(
          this.projectName,
          this.currentDirectoryId,
          resp.label,
          resp.description
        ).subscribe(
          (newMap: { project: Project, status}) => {
            const { project } = newMap;

            this.fileCollection = this.fileCollection.concat({
              ...project,
              type: 'map',
              routeLink: this.generateRouteLink(project, 'map')
            });
        });
      },
      () => {
      }
    );
  }

  delete(file: (Map|File|Directory)) {
    switch (
      file.type
    ) {
      case 'map':
        // TODO - bring in with jsonify_with_class
        // tslint:disable-next-line: no-string-literal
        const hashId = (file as Map).hashId || file['hash_id'];
        this.projPage.deleteMap(
          this.projectName,
          hashId
        ).subscribe(resp => {
          this.snackBar.open(`Deletion completed`, 'Close', {duration: 5000});
          this.fileCollection = this.fileCollection.filter(
            (f) => {
              if (f.type !== 'map') {
                return true;
              } else {
                // TODO - bring in with jsonify_with_class
                // tslint:disable-next-line: no-string-literal
                const fHashId = (f as Map).hashId || file['hash_id'];
                return hashId !== fHashId;
              }
            }
          );
        });
        break;
      case 'pdf':
        const fileId = (file as File).fileId;

        this.projPage.deletePDF(
          this.projectName,
          fileId
        ).subscribe(resp => {
          this.snackBar.open(`Deletion completed`, 'Close', {duration: 5000});
          this.fileCollection = this.fileCollection.filter(
            (f) => {
              if (f.type !== 'pdf') {
                return true;
              } else {
                const fHashId = (f as File).fileId;
                return fileId !== fHashId;
              }
            }
          );
        });
        break;
      case 'dir':
        break;
      default:
        break;
    }
  }
}

