import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PdfFiles, PdfFile, PdfFileUpload } from 'app/interfaces/file-browser.interface';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class PdfFilesService {
  constructor(
    private http: HttpClient,
  ) {}

  getFiles(): Observable<PdfFile[]> {
    return this.http.get<PdfFiles>('/api/files/list').pipe(
      map((res: PdfFiles) => res.files),
      catchError(err => {
        console.error(err);
        return of([]);
      }),
    );
  }

  uploadFile(file: File): Observable<PdfFileUpload> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    // formData.append('username', this_should_be_found_somewhere);
    return this.http.post<PdfFileUpload>('/api/files/upload', formData);
  }
}
