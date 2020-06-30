import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subscription, throwError, forkJoin } from 'rxjs';
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
import { map, tap } from 'rxjs/operators';
import { AddContentDialogComponent } from './add-content-dialog/add-content-dialog.component';

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  files: PdfFile[] = [];
  shownFiles: PdfFile[] = [];
  filterQuery = '';
  loadTask: BackgroundTask<void, PdfFile[]> = new BackgroundTask(() => this.pdf.getFiles());
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<PdfFile>(true, []);
  isReannotating = false;
  uploadStarted = false;
  lmdbsDates = {};

  // The project to pull content out of
  projectName = '';

  // The current directory we're residing in
  currentDirectoryId;
  currentDirectoryName = '';

  // The directory path from parent
  dirPathChain: string[] = [];
  dirPathId: number[] = [];

  // The list of files in a directory
  fileCollection: (Directory|Map)[] = [];

  fileSpaceSubscription: Subscription;

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

          console.log(resp);

          const {
            dir, id
          } = resp;

          console.log(dir, id);

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
              // Reset back to ***ARANGO_USERNAME*** directory
              this.dirPathChain = [];
              this.dirPathId = [];
            }
          }

          // If not empty, pull content from current dir id
          if (this.dirPathChain.length && this.dirPathId.length) {
            // Pull Content form subdir
            this.currentDirectoryId = this.dirPathId.slice(-1)[0];
            this.currentDirectoryName = this.dirPathChain.slice(-1)[0];

            this.projPage.getProjectDir(this.projectName, this.currentDirectoryId)
              .pipe(map(content => content.result))
              .subscribe(dirContent => this.processDirectoryContent(dirContent));
          } else {
            // Else pull Content from ***ARANGO_USERNAME***
            forkJoin([
              this.projSpace.getProject(this.projectName),
              this.projPage.projectRootDir(this.projectName)
            ])
            .pipe(
              tap(comboResp => {
                const p: Project = comboResp[0];
                this.currentDirectoryId = p.directory.projectsId;
              }),
              map(comboResp => comboResp[1])
            )
            .subscribe(dirContent => this.processDirectoryContent(dirContent));
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
          result: files,
        }
      ) => {
        // We assume that fetched files are correctly annotated
        this.updateAnnotationsStatus(files);
        this.updateFilter();
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
    this.loadTask.update();
  }

  isAllSelected(): boolean {
    if (!this.selection.selected.length) {
      return false;
    }
    for (const item of this.shownFiles) {
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
      this.selection.select(...this.shownFiles);
    }
  }

  /**
   * Get selected files that are also shown.
   */
  getSelectedShownFiles() {
    const result = [];
    for (const item of this.shownFiles) {
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

    this.pdf.uploadFile(data).pipe(this.errorHandler.create()).subscribe(event => {
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
    const ids: string[] = files.map((file: PdfFile) => file.file_id);
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
    const ids: string[] = this.selection.selected.map((file: PdfFile) => file.file_id);
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
    this.shownFiles = this.filterQuery.length ? this.files.filter(file => file.filename.includes(this.filterQuery)) : this.files;
  }

  displayUploadDialog() {
    const uploadData: UploadPayload = {
      type: UploadType.Files,
      filename: '',
    };

    const dialogRef = this.modalService.open(FileUploadDialogComponent);
    dialogRef.componentInstance.payload = uploadData;
    dialogRef.result.then((runUpload: boolean) => {
      if (runUpload) {
        this.upload(uploadData);
      }
    }, () => {
    });
  }

  displayEditDialog(file: PdfFile = null) {
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
      this.deleteFiles(files);
    }, () => {
    });
  }

  private updateAnnotationsStatus(files: PdfFile[]) {
    files.forEach((file: PdfFile) => {
      file.annotations_date_tooltip = this.generateTooltipContent(file);
    });
    this.files = [...files];
  }

  private generateTooltipContent(file: PdfFile): string {
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
  private processDirectoryContent(dirContent) {
    const content: {maps, childDirectories} = dirContent;

    let {
      maps,
      childDirectories
    } = content;

    maps = maps.map(
      (m: Map) => ({...m, type: 'map', routeLink: this.generateRouteLink(m, 'map')})
    );
    childDirectories = childDirectories.map(
      (d: Directory) => ({...d, type: 'dir', routeLink: this.generateRouteLink(d, 'dir')})
    );

    this.fileCollection = [].concat(maps, childDirectories);
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
        const {
          name,
          id
        } = (file as Directory);

        const dirs = [...this.dirPathChain, name];
        const ids = [...this.dirPathId, id];
        const querystring = this.encodeQueryData({ dir: dirs, id: ids });
        
        return `/projects/${this.projectName}?${querystring}`;
      case 'map':
        // TODO - refactor to server responses returning in camel case
        // .. pretty ugly right having to deal between camelCase and snakeCase
        const m: Map = file as Map;
        const hashId = m.hashId || m['hash_id']
        return `maps/${hashId}/edit`;
      case 'pdf':
        // TODO - implement
        return '';
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

    for (let d in data) {
      (data[d] as any[]).forEach(param => {
        ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(param))
      })
    }
    return ret.join('&');
 }

  /**
   * Navigate to a parent directory
   * @param index - idx of the parent directory in the directory chain
   */
  goUp(index) {
    const dirs = this.dirPathChain.slice(0, index+1);
    const ids = this.dirPathId.slice(0, index+1);

    if (dirs.length && ids.length) {
      // Go to sub directory
      this.router.navigate(
        [`/projects/${this.projectName}/`],
        { queryParams: { dir: dirs, id: ids } }
      );
    } else {
      // Go to project ***ARANGO_USERNAME***
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
            this.fileCollection.push({
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
          (resp: { project: Project, status}) => {
            console.log(resp);
            const { project } = resp;
            this.fileCollection.push({
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
}

