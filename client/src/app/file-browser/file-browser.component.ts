import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material';
import { AnnotationStatus, PdfFile, PdfFileUpload, Reannotation } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['select', 'filename', 'creationDate', 'username', 'annotation'];
  dataSource: PdfFile[] = [];
  isUploading = false;
  selection = new SelectionModel<PdfFile>(true, []);
  selectionChanged: Subscription;
  canOpen = false;
  isReannotating = false;

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.updateDataSource();
    this.selectionChanged = this.selection.changed.subscribe(() => this.canOpen = this.selection.selected.length === 1);
  }

  ngOnDestroy() {
    this.selectionChanged.unsubscribe();
  }

  updateDataSource() {
    this.pdf.getFiles().subscribe(
      (files: PdfFile[]) => {
        // We assume that fetched files are correctly annotated
        files.forEach((file: PdfFile) => file.annotation_status = AnnotationStatus.Success);
        this.dataSource = files;
      },
      err => {
        this.snackBar.open(`Cannot fetch list of files: ${err}`, 'Close', {duration: 10000});
      }
    );
  }

  onFileInput(files: FileList) {
    if (files.length === 0) {
      return;
    }
    this.isUploading = true;
    this.pdf.uploadFile(files[0]).subscribe(
      (res: PdfFileUpload) => {
        this.isUploading = false;
        this.snackBar.open(`File uploaded: ${res.filename}`, 'Close', {duration: 5000});
        this.updateDataSource(); // updates the list on successful upload
      },
      err => {
        this.isUploading = false;
        this.snackBar.open(`Error on upload: ${err}`, 'Close', {duration: 10000});
      }
    );
  }

  openFile() {
    localStorage.setItem('fileIdForPdfViewer', this.selection.selected[0].file_id);
    this.router.navigate(['/pdf-viewer']);
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
          const file: PdfFile = this.dataSource.find((f: PdfFile) => f.file_id === id);
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
          const file: PdfFile = this.dataSource.find((f: PdfFile) => f.file_id === id);
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
    // TODO: remove debug console.logs once we feel this function is not buggy
    if (this.selection.selected.length === this.dataSource.length) {
      this.selection.clear();
      console.log('masterToggle() same length');
    } else {
      this.selection.select(...this.dataSource);
      console.log('masterToggle() different length');
    }
    console.log('masterToggle() selected before return', this.selection.selected);
  }
}
