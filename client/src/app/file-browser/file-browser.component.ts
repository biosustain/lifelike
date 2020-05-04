import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material';
import { BehaviorSubject, Subject, throwError } from 'rxjs';
import { AnnotationStatus, PdfFile, Reannotation } from 'app/interfaces/pdf-files.interface';
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
export class FileBrowserComponent implements OnInit {
  displayedColumns: string[] = ['select', 'filename', 'creationDate', 'username', 'annotation'];
  dataSource = new MatTableDataSource<PdfFile>([]);
  selection = new SelectionModel<PdfFile>(true, []);
  isReannotating = false;
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
    this.updateDataSource();
  }

  updateDataSource() {
    this.pdf.getFiles().subscribe(
      (files: PdfFile[]) => {
        // We assume that fetched files are correctly annotated
        files.forEach((file: PdfFile) => file.annotation_status = AnnotationStatus.Success);
        this.dataSource.data = files;
      },
      err => {
        this.snackBar.open(`Cannot fetch list of files: ${err}`, 'Close', {duration: 10000});
      }
    );
    this.selection.clear();
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
          this.updateDataSource(); // updates the list on successful upload
        }
      },
      err => {
        this.status = UploadStatus.Ready;
        this.dialog.closeAll();
        return throwError(err);
      }
    );
  }

  openFile(fileId: string) {
    localStorage.setItem('fileIdForPdfViewer', fileId);
    this.router.navigate(['/pdf-viewer']);
  }

  deleteFiles() {
    const ids: string[] = this.selection.selected.map((file: PdfFile) => file.file_id);
    this.pdf.deleteFiles(ids).subscribe(
      (res: string) => {
        this.snackBar.open(`Deletion completed`, 'Close', {duration: 5000});
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
    this.pdf.reannotateFiles(ids).subscribe(
      (res: Reannotation) => {
        for (const id of ids) {
          // pick file by id
          const file: PdfFile = this.dataSource.data.find((f: PdfFile) => f.file_id === id);
          // set its annotation status
          file.annotation_status = res[id] === 'Annotated' ? AnnotationStatus.Success : AnnotationStatus.Failure;
        }
        this.isReannotating = false;
        this.snackBar.open(`Reannotation completed`, 'Close', {duration: 5000});
        console.log('reannotation result', res);
      },
      err => {
        for (const id of ids) {
          // pick file by id
          const file: PdfFile = this.dataSource.data.find((f: PdfFile) => f.file_id === id);
          // mark it as failed
          file.annotation_status = AnnotationStatus.Failure;
        }
        this.isReannotating = false;
        this.snackBar.open(`Reannotation failed`, 'Close', {duration: 10000});
        console.error('reannotation error', err);
      }
    );
  }

  // Adapted from https://v8.material.angular.io/components/table/overview#selection
  masterToggle() {
    if (this.selection.selected.length === this.dataSource.data.length) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.data);
    }
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

  applyFilter(filterValue: string) {
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
