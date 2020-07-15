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
  // Length limits. Keep these in sync with the values in the backend code (/models folder)
  readonly filenameMaxLength = 200;
  readonly descriptionMaxLength = 2048;

  constructor(
    private auth: AuthenticationService,
    private http: HttpClient,
  ) {
  }

  getFiles(): Observable<PdfFile[]> {
    const options = { headers: this.getAuthHeader() };
    return this.http.get<PdfFiles>(`${this.baseUrl}/list`, options).pipe(
      map((res: PdfFiles) => res.files),
    );
  }

  getFileInfo(id: string, projectName: string = 'beta-project'): Observable<PdfFile> {
    const options = {
      headers: this.getAuthHeader(),
    };
    return this.http.get<PdfFile>(`/api/projects/${projectName}/files/${id}/info`, options);
  }

  getFile(id: string, projectName: string = 'beta-project'): Observable<ArrayBuffer> {
    const options = {
      headers: this.getAuthHeader(),
      responseType: 'arraybuffer' as const,
    };
    return this.http.get(`/api/projects/${projectName}/files/${id}`, options);
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
    formData.append('filename', data.filename.substring(0, this.filenameMaxLength));
    if (data.description && data.description.length > 0) {
      formData.append('description', data.description.substring(0, this.descriptionMaxLength));
    }
    if (data.type === UploadType.Files) {
      formData.append('fileInput', data.files[0]);
    } else {
      formData.append('url', data.url);
    }
    formData.append('annotationMethod', data.annotationMethod);
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

  updateFile(id: string, filename: string, description: string = ''): Observable<string> {
    const options = { headers: this.getAuthHeader() };
    const formData: FormData = new FormData();
    formData.append('filename', filename.substring(0, this.filenameMaxLength));
    formData.append('description', description.substring(0, this.descriptionMaxLength));
    return this.http.patch<string>(`${this.baseUrl}/${id}`, formData, options);
  }

  private getAuthHeader() {
    return { Authorization: `Bearer ${this.auth.getAccessToken()}` };
  }

  getLMDBsDates(): Observable<object> {
    const options = { headers: this.getAuthHeader() };
    return this.http.get<object>(`${this.baseUrl}/lmdbs_dates`, options);
  }
}
