import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subscription, throwError } from 'rxjs';
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

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
    private readonly modalService: NgbModal,
    private progressDialog: ProgressDialog,
  ) {
  }

  ngOnInit() {
    this.pdf.getLMDBsDates().subscribe(lmdbsDates => {
      this.lmdbsDates = lmdbsDates;
      this.updateAnnotationsStatus(this.files);
    });
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({
                                                                    result: files,
                                                                  }) => {
        // We assume that fetched files are correctly annotated
        this.updateAnnotationsStatus(files);
        this.updateFilter();
      },
    );

    this.refresh();
  }

  ngOnDestroy(): void {
    this.loadTaskSubscription.unsubscribe();
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

    this.pdf.uploadFile(data).subscribe(event => {
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
    this.pdf.deleteFiles(ids).subscribe(
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
    this.pdf.reannotateFiles(ids).subscribe(
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
      }
    );
  }

  applyFilter(query: string) {
    this.filterQuery = query.trim();
    this.updateFilter();
  }

  private updateFilter() {
    this.shownFiles = this.filterQuery.length ? this.files.filter(file => file.filename.includes(this.filterQuery)) : this.files;
  }

  showUploadDialog() {
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

  showEditDialog(file: PdfFile = null) {
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
    const outdated = Array.
    from(Object.entries(this.lmdbsDates)).
    filter(([, date]: [string, string]) => Date.parse(date) >= Date.parse(file.annotations_date));
    if (outdated.length === 0) {
      return '';
    }
    return outdated.reduce(
      (tooltip: string, [name, date]: [string, string]) => `${tooltip}\n- ${name}, ${new Date(date).toDateString()}`,
      'Outdated:'
    );
  }
}

