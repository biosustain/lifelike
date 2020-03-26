import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { PdfFiles, PdfFile } from 'app/interfaces/file-browser.interface';


@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
  styleUrls: ['./file-browser.component.scss']
})
export class FileBrowserComponent implements OnInit {
  displayedColumns: string[] = ['filename', 'creationDate', 'username', 'annotation'];
  dataSource: PdfFile[] = [];

  constructor(
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.http.get<PdfFiles>('/api/files/list').subscribe(
      (res: PdfFiles) => this.dataSource = res.files,
      err => console.log('error during fetch', err),
    );
  }

  onFileInput(files: FileList) {
    if (files.length === 0) {
      return;
    }
    const formData: FormData = new FormData();
    formData.append('file', files[0]);
    // formData.append('username', this_should_be_found_somewhere);
    this.http.post('/api/files/upload', formData).subscribe(
      res => console.log('successful upload', res),
      err => console.log('error during upload', err),
    );
  }
}
