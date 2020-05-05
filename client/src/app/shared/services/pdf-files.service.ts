import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { PdfFiles, PdfFile, PdfFileUpload } from 'app/interfaces/pdf-files.interface';

@Injectable({
  providedIn: '***ARANGO_USERNAME***'
})
export class PdfFilesService {
  readonly baseUrl = '/api/files';

  constructor(
    private auth: AuthenticationService,
    private http: HttpClient,
  ) {
  }

  getFiles(): Observable<PdfFile[]> {
    return this.http.get<PdfFiles>(
      `${this.baseUrl}/list`,
      this.buildHttpOptions(),
    ).pipe(
      map((res: PdfFiles) => res.files),
      catchError(err => {
        console.error(err);
        return of([]);
      }),
    );
  }

  getFile(id: string): Observable<ArrayBuffer> {
    const options = Object.assign(this.buildHttpOptions(), {responseType: 'arraybuffer'});
    return this.http.get<ArrayBuffer>(`${this.baseUrl}/${id}`, options);
  }

  deleteFiles(ids: string[]): Observable<object> {
    return this.http.request('DELETE', `${this.baseUrl}/bulk_delete`, {body: ids, ...this.buildHttpOptions()});
  }

  uploadFile(file: File): Observable<HttpEvent<PdfFileUpload>> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    return this.http.post<PdfFileUpload>(`${this.baseUrl}/upload`, formData, {
      ...this.buildHttpOptions(),
      observe: 'events',
      reportProgress: true,
    });
  }

  reannotateFiles(ids: string[]): Observable<object> {
    return this.http.post(
      `${this.baseUrl}/reannotate`,
      ids,
      this.buildHttpOptions()
    );
  }

  private buildHttpOptions() {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.auth.getAccessToken()}`
      }),
    };
  }
}
