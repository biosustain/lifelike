import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Subscription, throwError } from 'rxjs';
import { AnnotationStatus, PdfFile, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HttpEventType } from '@angular/common/http';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss'],
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  files: PdfFile[];
  shownFiles: PdfFile[];
  filterQuery = '';
  loadTask: BackgroundTask<void, PdfFile[]> = new BackgroundTask(() => this.pdf.getFiles());
  loadTaskSubscription: Subscription;
  selection = new SelectionModel<PdfFile>(true, []);
  isReannotating = false;
  uploadStarted = false;

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
    private ngbModal: NgbModal,
    private progressDialog: ProgressDialog,
  ) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(([files]) => {
        // We assume that fetched files are correctly annotated
        files.forEach((file: PdfFile) => file.annotation_status = AnnotationStatus.Success);
        this.files = files;
        this.updateFilter();
      },
      err => {
        this.snackBar.open(`Cannot fetch list of files: ${err}`, 'Close', {duration: 10000});
      }
    );

    this.updateDataSource();
  }

  ngOnDestroy(): void {
    this.loadTaskSubscription.unsubscribe();
  }

  updateDataSource() {
    this.selection.clear();
    this.loadTask.update();
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
              value: event.loaded / event.total
            }));
          } else {
            progressObservable.next(new Progress({
              mode: ProgressMode.Determinate,
              status: 'Uploading file...',
              value: event.loaded / event.total
            }));
          }
        } else if (event.type === HttpEventType.Response) {
          progressDialogRef.close();
          this.uploadStarted = false;
          this.snackBar.open(`File uploaded: ${event.body.filename}`, 'Close', {duration: 5000});
          this.updateDataSource(); // updates the list on successful upload
        }
      },
      err => {
        progressDialogRef.close();
        this.uploadStarted = false;
        return throwError(err);
      }
    );
  }

  openFile(fileId: string) {
    this.router.navigateByUrl(`pdf-viewer/${fileId}`);
  }

  deleteFiles() {
    const ids: string[] = this.selection.selected.map((file: PdfFile) => file.file_id);
    this.pdf.deleteFiles(ids).subscribe(
      (res) => {
        let msg = 'Deletion completed';
        if (Object.values(res).includes('Not an owner')) { // check if any file was not owned by the current user
          msg = `${msg}, but one or more files could not be deleted because you are not the owner`;
        }
        this.snackBar.open(msg, 'Close', {duration: 10000});
        this.updateDataSource(); // updates the list on successful deletion
        console.log('deletion result', res);
      },
      err => {
        this.snackBar.open(`Deletion failed`, 'Close', {duration: 10000});
        console.error('deletion error', err);
      }
    );
  }

  reannotate() {
    this.isReannotating = true;
    const ids: string[] = this.selection.selected.map((file: PdfFile) => {
      file.annotation_status = AnnotationStatus.Loading;
      return file.file_id;
    });
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
        for (const id of ids) {
          // pick file by id
          const file: PdfFile = this.files.find((f: PdfFile) => f.file_id === id);
          // set its annotation status
          file.annotation_status = res[id] === 'Annotated' ? AnnotationStatus.Success : AnnotationStatus.Failure;
        }
        this.isReannotating = false;
        this.snackBar.open(`Reannotation completed`, 'Close', {duration: 5000});
        progressDialogRef.close();
      },
      err => {
        for (const id of ids) {
          // pick file by id
          const file: PdfFile = this.files.find((f: PdfFile) => f.file_id === id);
          // mark it as failed
          file.annotation_status = AnnotationStatus.Failure;
        }
        this.isReannotating = false;
        this.snackBar.open(`Reannotation failed`, 'Close', {duration: 10000});
        progressDialogRef.close();
      }
    );
  }

  // Adapted from https://v8.material.angular.io/components/table/overview#selection
  masterToggle() {
    if (this.selection.selected.length === this.files.length) {
      this.selection.clear();
    } else {
      this.selection.select(...this.files);
    }
  }

  applyFilter(query: string) {
    this.filterQuery = query.trim();
    this.updateFilter();
  }

  private updateFilter() {
    this.shownFiles = this.filterQuery.length ? this.files.filter(file => file.filename.includes(this.filterQuery)) : this.files;
  }

  openDeleteDialog() {
    const dialogRef = this.ngbModal.open(DialogConfirmDeletionComponent);
    dialogRef.componentInstance.files = this.selection.selected;

    dialogRef.result.then(shouldDelete => {
      if (shouldDelete) {
        this.deleteFiles();
      }
    });
  }

  openUploadDialog() {
    const uploadData: UploadPayload = {type: UploadType.Files}; // doesn't matter what we set it to, but it needs a value

    const dialogRef = this.ngbModal.open(DialogUploadComponent);
    dialogRef.componentInstance.payload = uploadData;

    dialogRef.result.then((runUpload: boolean) => {
      if (runUpload) {
        this.upload(uploadData);
      }
    });
  }
}

@Component({
  selector: 'app-dialog-confirm-deletion',
  templateUrl: './dialog-confirm-deletion.html',
})
export class DialogConfirmDeletionComponent {
  @Input() files;

  constructor(public activeModal: NgbActiveModal) {
  }
}

@Component({
  selector: 'app-dialog-upload',
  templateUrl: './dialog-upload.html',
  styleUrls: ['./dialog-upload.scss'],
})
export class DialogUploadComponent implements OnInit, OnDestroy {
  forbidUpload = true;
  pickedFileName: string;
  @Input() payload: UploadPayload; // to avoid writing this.data.payload everywhere

  selectedTab = new FormControl(0);
  tabChange: Subscription;

  filename = new FormControl('');
  filenameChange: Subscription;
  url = new FormControl('');
  urlChange: Subscription;

  activeTab: string;

  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    this.filenameChange = this.filename.valueChanges.subscribe((value: string) => {
      this.payload.filename = value;
      this.validatePayload();
    });
    this.urlChange = this.url.valueChanges.subscribe((value: string) => {
      this.payload.url = value;
      this.validatePayload();
    });
    this.tabChange = this.selectedTab.valueChanges.subscribe(value => {
      this.payload.type = value === 0 ? UploadType.Files : UploadType.Url;
      this.validatePayload();
    });
  }

  ngOnDestroy() {
    this.urlChange.unsubscribe();
    this.tabChange.unsubscribe();
  }

  /** Called upon picking a file from the Browse button */
  onFilesPick(fileList: FileList) {
    const files: File[] = [];
    for (let i = 0; i < fileList.length; ++i) {
      files.push(fileList.item(i));
    }
    this.payload.files = files;
    this.pickedFileName = fileList.length ? fileList[0].name : '';
    this.validatePayload();
  }

  /** Validates if the Upload button should be enabled or disabled */
  validatePayload() {
    const filesIsOk = this.payload.files && this.payload.files.length > 0;
    const filenameIsOk = this.payload.filename && this.payload.filename.length > 0;
    const urlIsOk = this.payload.url && this.payload.url.length > 0;
    if (this.payload.type === UploadType.Files) {
      this.forbidUpload = !filesIsOk;
    } else { // UploadType.Url
      this.forbidUpload = !(filenameIsOk && urlIsOk);
    }
  }
}
