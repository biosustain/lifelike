import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { PdfFile, PdfFileUpload, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { AbstractService } from './abstract-service';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PdfFilesService extends AbstractService {
  readonly PROJECTS_BASE_URL = '/api/projects';
  readonly FILES_BASE_URL = '/api/files';
  readonly ANNOTATIONS_BASE_URL = '/api/annotations';

  // Length limits. Keep these in sync with the values in the backend code (/models folder)
  readonly FILENAME_MAX_LENGTH = 200;
  readonly DESCRIPTION_MAX_LENGTH = 2048;

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  // ========================================
  // Fetch
  // ========================================

  getFileMeta(id: string, projectName: string = 'beta-project'): Observable<PdfFile> {
    return this.http.get<PdfFile>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(id)}/info`,
      this.getHttpOptions(true),
    );
  }

  getFile(id: string, projectName: string = 'beta-project'): Observable<ArrayBuffer> {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(id)}`, {
        ...this.getHttpOptions(true),
        responseType: 'arraybuffer',
      });
  }

  // ========================================
  // CRUD
  // ========================================

  uploadFile(projectName, parentDir, data: UploadPayload): Observable<PdfFileUpload> {
    const formData: FormData = new FormData();

    formData.append('filename', data.filename.substring(0, this.FILENAME_MAX_LENGTH));
    formData.append('directoryId', parentDir);
    formData.append('annotationMethod', data.annotationMethod);
    formData.append('description', data.description ? data.description.substring(0, this.DESCRIPTION_MAX_LENGTH) : '');

    switch (data.type) {
      case UploadType.Files:
        formData.append('fileInput', data.files[0]);
        break;
      case UploadType.Url:
        formData.append('url', data.url);
        break;
      default:
        throw new Error('unsupported upload type');
    }

    return this.http.post<{result: PdfFileUpload}>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files`,
      formData,
      {...this.getHttpOptions(true)},
    ).pipe(map(res => res.result));
  }

  annotateFile(projectName: string, fileId: string, annotationMethod: string): Observable<HttpEvent<object>> {
    return this.http.post<object>(
      `${this.ANNOTATIONS_BASE_URL}/${encodeURIComponent(projectName)}/${fileId}`,
      {annotationMethod},
      {
        ...this.getHttpOptions(true),
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  updateFileMeta(projectName: string, id: string, filename: string, description: string = ''): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('filename', filename.substring(0, this.FILENAME_MAX_LENGTH));
    formData.append('description', description.substring(0, this.DESCRIPTION_MAX_LENGTH));
    return this.http.patch<string>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(id)}`,
      formData,
      this.getHttpOptions(true),
    );
  }

  reannotateFiles(projectName: string, fileIds: string[], annotationMethod: string = 'Rules Based'): Observable<object> {
    return this.http.post(
      `${this.ANNOTATIONS_BASE_URL}/${projectName}/reannotate`,
      {annotationMethod, fileIds}, this.getHttpOptions(true));
  }

  deleteFile(projectName, fileId): Observable<any> {
    return this.http.request(
      'delete',
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files`, {
        body: [fileId],
        ...this.getHttpOptions(true),
      });
  }

  // ========================================
  // Utility
  // ========================================

  getLMDBsDates(): Observable<object> {
    return this.http.get<object>(
      `${this.FILES_BASE_URL}/lmdbs_dates`,
      this.getHttpOptions(true),
    );
  }
}
