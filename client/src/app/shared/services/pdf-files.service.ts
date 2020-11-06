import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpResponse } from '@angular/common/http';
import { from, Observable } from 'rxjs';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { PdfFile, PdfFileUpload, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { OrganismAutocomplete } from 'app/interfaces/neo4j.interface';
import { AbstractService } from './abstract-service';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
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

  getFileFallbackOrganism(projectName: string, fileId: string): Observable<string> {
    return this.http.get<{result: string}>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(fileId)}/fallback-organism`,
      this.getHttpOptions(true),
    ).pipe(map(res => res.result));
  }

  // ========================================
  // CRUD
  // ========================================
  validateFilename(parentDirId, filename): Observable<boolean> {
    return this.http.get<{result: boolean}>(
      `${this.PROJECTS_BASE_URL}/directory/${parentDirId}/${filename}`,
      this.getHttpOptions(true)
    ).pipe(map(resp => resp.result));
  }

  addGeneList(projectName, directoryId, enrichmentData: string, description: string, filename: string): Observable<any> {
    return this.http.post<{result: any}>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/enrichment-table`,
      {description, filename, enrichmentData, directoryId},
      {...this.getHttpOptions(true)},
    );
  }

  editGeneList(projectName, fileId, enrichmentData, name, description): Observable<any> {
    return this.http.patch<{result: any}>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/enrichment-table/${encodeURIComponent(fileId)}`,
      {enrichmentData, name, description},
      {...this.getHttpOptions(true)},
    );
  }

  getEnrichmentData(projectName, fileId): Observable<any> {
    return this.http.get(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/enrichment-table/${encodeURIComponent(fileId)}`, {
        ...this.getHttpOptions(true),
      });
  }

  downloadFile(pid: number): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.FILES_BASE_URL}/download/${pid}`, {
        ...this.getHttpOptions(true),
        responseType: 'blob',
        observe: 'response',
      });
  }

  uploadFile(projectName, parentDir, data: UploadPayload): Observable<PdfFileUpload> {
    const formData: FormData = new FormData();

    formData.append('filename', data.filename.substring(0, this.FILENAME_MAX_LENGTH));
    formData.append('directoryId', parentDir);
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

  annotateFile(
    projectName: string,
    fileId: string,
    annotationMethod: string,
    organism: OrganismAutocomplete
  ): Observable<HttpEvent<object>> {
    return this.http.post<object>(
      `${this.ANNOTATIONS_BASE_URL}/${encodeURIComponent(projectName)}/${fileId}`,
      {annotationMethod, organism},
      {
        ...this.getHttpOptions(true),
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  updateFileMeta(
    projectName: string,
    id: string,
    filename: string,
    fallbackOrganism: OrganismAutocomplete,
    description: string = '',
  ): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('filename', filename.substring(0, this.FILENAME_MAX_LENGTH));
    formData.append('description', description.substring(0, this.DESCRIPTION_MAX_LENGTH));

    if (fallbackOrganism) {
      formData.append('organism', JSON.stringify(fallbackOrganism));
    }
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

  moveFile(projectName: string,
           fileId: string,
           destinationDirectoryId: number): Observable<any> {
    return this.http.post<PdfFile>(
        `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(fileId)}/move`, {
          destination: {
            directoryId: destinationDirectoryId,
          },
        },
        this.getHttpOptions(true),
    );

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
