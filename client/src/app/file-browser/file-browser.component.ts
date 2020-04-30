import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, Subscription, throwError } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { HttpEventType } from '@angular/common/http';
import { UploadProgress, UploadStatus } from 'app/interfaces/file-browser.interfaces';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { UploadProgressDialogComponent } from './upload-progress-dialog.component';

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss'],
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['select', 'filename', 'creationDate', 'username', 'annotation'];
  dataSource: Observable<PdfFile[]>;
  selection = new SelectionModel<PdfFile>(false, []);
  selectionChanged: Subscription;
  canOpen = false;
  status = UploadStatus.Ready;
  /**
   * Progress events will be streamed to the progress dialog.
   */
  progress: Subject<UploadProgress> = new BehaviorSubject<UploadProgress>(
    new UploadProgress(UploadStatus.Ready, 0)
  );

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
    public dialog: MatDialog,
  ) {
  }

  ngOnInit() {
    this.dataSource = this.pdf.getFiles();
    this.selectionChanged = this.selection.changed.subscribe(() => this.canOpen = this.selection.hasValue());
  }

  ngOnDestroy() {
    this.selectionChanged.unsubscribe();
  }

  onFileInput(files: FileList) {
    if (files.length === 0) {
      return;
    }
    if (this.status !== UploadStatus.Ready) {
      // the user shouldn't be able to initiate a new file upload
      return;
    }

    const name = files[0].name;
    this.status = UploadStatus.Starting;

    // Let's show some progress!
    this.progress.next(new UploadProgress(this.status, 0, name));
    this.openProgressDialog();

    this.pdf.uploadFile(files[0]).subscribe(event => {
        if (event.type === HttpEventType.UploadProgress) {
          if (event.loaded >= event.total) {
            this.status = UploadStatus.Processing;
          } else {
            this.status = UploadStatus.Uploading;
          }
          this.progress.next(new UploadProgress(this.status, event.loaded / event.total, name));
        } else if (event.type === HttpEventType.Response) {
          this.progress.next(new UploadProgress(this.status, 1, name));
          this.status = UploadStatus.Ready;
          this.dialog.closeAll();
          this.snackBar.open(`File uploaded: ${event.body.filename}`, 'Close', {duration: 5000});
          this.dataSource = this.pdf.getFiles(); // updates the list on successful upload
        }
      },
      err => {
        this.status = UploadStatus.Ready;
        this.dialog.closeAll();
        return throwError(err);
      }
    );
  }

  openFile() {
    localStorage.setItem('fileIdForPdfViewer', this.selection.selected[0].file_id);
    this.router.navigate(['/pdf-viewer']);
  }

  /**
   * Show the upload progress dialog to the user.
   */
  openProgressDialog() {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.width = '400px';
    dialogConfig.disableClose = true;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {
      progress: this.progress
    };

    this.dialog.open(UploadProgressDialogComponent, dialogConfig);
  }
}
