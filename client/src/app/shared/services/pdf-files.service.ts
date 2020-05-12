import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { PdfFiles, PdfFile, PdfFileUpload, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';

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
    const options = { headers: this.getAuthHeader() };
    return this.http.get<PdfFiles>(`${this.baseUrl}/list`, options).pipe(
      map((res: PdfFiles) => res.files),
      catchError(err => {
        console.error(err);
        return of([]);
      }),
    );
  }

  getFile(id: string): Observable<ArrayBuffer> {
    const options = {
      headers: this.getAuthHeader(),
      responseType: 'arraybuffer' as const,
    };
    return this.http.get(`${this.baseUrl}/${id}`, options);
  }

  deleteFiles(ids: string[]): Observable<object> {
    const options = {
      body: ids,
      headers: this.getAuthHeader(),
    };
    return this.http.request('DELETE', `${this.baseUrl}/bulk_delete`, options);
  }

  uploadFile(data: UploadPayload): Observable<HttpEvent<PdfFileUpload>> {
    const formData: FormData = new FormData();
    if (data.type === UploadType.Files) {
      formData.append('file', data.files[0]);
    } else {
      formData.append('filename', data.filename);
      formData.append('url', data.url);
    }
    return this.http.post<PdfFileUpload>(`${this.baseUrl}/upload`, formData, {
      headers: this.getAuthHeader(),
      observe: 'events',
      reportProgress: true,
    });
  }

  reannotateFiles(ids: string[]): Observable<object> {
    const options = { headers: this.getAuthHeader() };
    return this.http.post(`${this.baseUrl}/reannotate`, ids, options);
  }

  private getAuthHeader() {
    return { Authorization: `Bearer ${this.auth.getAccessToken()}` };
  }
}
