import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { PdfFiles, PdfFile, PdfFileUpload } from 'app/interfaces/pdf-files.interface';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class PdfFilesService {
  constructor(
    private auth: AuthenticationService,
    private http: HttpClient,
  ) {}

  getFiles(): Observable<PdfFile[]> {
    return this.http.get<PdfFiles>('/api/files/list', this.buildHttpOptions()).pipe(
      map((res: PdfFiles) => res.files),
      catchError(err => {
        console.error(err);
        return of([]);
      }),
    );
  }

  getFile(id: string): Observable<ArrayBuffer> {
    const options = Object.assign(this.buildHttpOptions(), {responseType: 'arraybuffer'});
    return this.http.get<ArrayBuffer>(`/api/files/${id}`, options);
  }

  uploadFile(file: File): Observable<PdfFileUpload> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    return this.http.post<PdfFileUpload>('/api/files/upload', formData, this.buildHttpOptions());
  }

  private buildHttpOptions() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.auth.getAccessToken()}`
      }),
    };
  }
}
