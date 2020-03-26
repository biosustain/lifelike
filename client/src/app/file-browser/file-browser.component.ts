import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { PdfFile, PdfFileUpload } from 'app/interfaces/pdf-files.interface';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { MatSnackBar } from '@angular/material';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent implements OnInit {
  displayedColumns: string[] = ['filename', 'creationDate', 'username', 'annotation'];
  dataSource: Observable<PdfFile[]>;

  constructor(
    private pdf: PdfFilesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    // this.dataSource = this.pdf.getFiles(); // TODO: uncomment when backend is integrated
  }

  onFileInput(files: FileList) {
    if (files.length === 0) {
      return;
    }
    this.pdf.uploadFile(files[0]).subscribe(
      (res: PdfFileUpload) => {
        this.snackBar.open(`File uploaded: ${res.filename}`, 'Close', {duration: 5000});
        this.dataSource = this.pdf.getFiles(); // update the list on successful upload
      },
      err => {
        this.snackBar.open(`Error on upload: ${err}`, 'Close', {duration: 10000});
      }
    );
  }
}
