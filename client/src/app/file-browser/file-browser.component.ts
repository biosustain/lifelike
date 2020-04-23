import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { SelectionModel } from '@angular/cdk/collections';
import { MatSnackBar } from '@angular/material';
import { PdfFile, PdfFileUpload } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['select', 'filename', 'creationDate', 'username', 'annotation'];
  dataSource: Observable<PdfFile[]>;
  isUploading = false;
  selection = new SelectionModel<PdfFile>(false, []);
  selectionChanged: Subscription;
  canOpen = false;
  isReannotating = false;

  constructor(
    private pdf: PdfFilesService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

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
    this.isUploading = true;
    this.pdf.uploadFile(files[0]).subscribe(
      (res: PdfFileUpload) => {
        this.isUploading = false;
        this.snackBar.open(`File uploaded: ${res.filename}`, 'Close', {duration: 5000});
        this.dataSource = this.pdf.getFiles(); // updates the list on successful upload
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
    this.pdf.reannotateFile(this.selection.selected[0].file_id).subscribe(
      (res) => {
        this.isReannotating = false;
        this.snackBar.open(`Reannotation succeeded`, 'Close', {duration: 5000});
        console.log('reannotation result', res);
      },
      err => {
        this.isReannotating = false;
        this.snackBar.open(`Reannotation failed`, 'Close', {duration: 10000});
        console.error('reannotation error', err);
      }
    );
  }
}
