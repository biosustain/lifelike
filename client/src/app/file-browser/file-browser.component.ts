import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material';
import { PdfFile, PdfFileUpload } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent implements OnInit {
  displayedColumns: string[] = ['filename', 'creationDate', 'username', 'annotation'];
  dataSource: Observable<PdfFile[]>;
  isUploading = false;

  constructor(
    private pdf: PdfFilesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.dataSource = this.pdf.getFiles();
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
}
