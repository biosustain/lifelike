import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PdfFileUpload, UploadPayload, UploadType } from 'app/interfaces/pdf-files.interface';
import { isNullOrUndefined } from 'util';
import { option } from 'vis-util';
import { DirectoryContent } from '../../interfaces/projects.interface';
import { KnowledgeMap } from '../../drawing-tool/services/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ProjectPageService {
  readonly projectsAPI = '/api/projects';

  // Length limits. Keep these in sync with the values in the backend code (/models folder)
  readonly filenameMaxLength = 200;
  readonly descriptionMaxLength = 2048;

  constructor(private http: HttpClient) {
  }

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt - boolean representing whether to return the options with a jwt
   */
  createHttpOptions(withJwt = false) {
    if (withJwt) {
      return {
        headers: new HttpHeaders({
          Authorization: 'Bearer ' + localStorage.getItem('access_jwt'),
        }),
      };
    } else {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      };
    }
  }

  /**
   * Return list of maps that are made public by user
   */
  publicMaps(): Observable<KnowledgeMap[]> {
    return this.http.get<KnowledgeMap[]>(
      `/api/drawing-tool/community`,
      this.createHttpOptions(true)
    );
  }

  /**
   * Return content of top level directory of project
   * @param projectName - name of project
   */
  projectRootDir(
    projectName,
  ): Observable<any> {
    return this.http.get<DirectoryContent>(
      `${this.projectsAPI}/${projectName}/directories`,
      this.createHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  /**
   * Return content of a directory inside of a project
   * @param projectName -
   * @param directoryId -
   */
  getProjectDir(
    projectName,
    directoryId = null,
  ): Observable<DirectoryContent> {
    if (isNullOrUndefined(directoryId)) {
      return this.projectRootDir(projectName);
    } else {
      return this.http.get<any>(
        `${this.projectsAPI}/${projectName}/directories/${directoryId}`,
        this.createHttpOptions(true),
      ).pipe(
        map(resp => resp.result),
      );
    }
  }

  /** API for project space items */

  addMap(
    projectName,
    directoryId,
    label,
    description,
    publicMap,
  ): Observable<any> {
    console.log(isPublic);

    return this.http.post<any>(
      `${this.projectsAPI}/${projectName}/map`,
      {
        label,
        description,
        directoryId,
        public: publicMap,
      },
      this.createHttpOptions(true),
    );
  }

  /**
   * Add a directory under a folder of a project
   * @param projectName - project to add directory to
   * @param dirname - name for the directory you want to add
   * @param parentDir - directory that you're adding to underneath
   */
  addDir(
    projectName,
    parentDir = null,
    dirname,
  ): Observable<any> {
    return this.http.post<any>(
      `${this.projectsAPI}/${projectName}/directories`,
      {dirname, parentDir},
      this.createHttpOptions(true),
    ).pipe(
      map(resp => resp.results),
    );
  }

  /**
   * Handle uploading of pdf with progress streaming
   * @param projectName - the project to upload the pdf in
   * @param parentDir - the directory to create the file in
   * @param data - represent the pdf file data
   */
  addPdf(
    projectName,
    parentDir,
    data: UploadPayload,
  ): Observable<HttpEvent<PdfFileUpload>> {
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

    formData.append('directoryId', parentDir);

    formData.append('annotationMethod', data.annotationMethod);

    const url = `${this.projectsAPI}/${projectName}/files`;
    const options = this.createHttpOptions(true);

    return this.http.post<PdfFileUpload>(
      url,
      formData,
      {
        ...options,
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  updateFile(projectName: string, id: string, filename: string, description: string = ''): Observable<string> {
    const formData: FormData = new FormData();
    formData.append('filename', filename.substring(0, this.filenameMaxLength));
    formData.append('description', description.substring(0, this.descriptionMaxLength));
    return this.http.patch<string>(
      `${this.projectsAPI}/${encodeURIComponent(projectName)}/files/${encodeURIComponent(id)}`,
      formData,
      this.createHttpOptions(true),
    );
  }

  /**
   * Delete map from project
   * @param projectName - project containing asset to delete
   * @param hashId - represent asset we want to delete
   */
  deleteMap(
    projectName,
    hashId,
  ): Observable<any> {
    return this.http.delete(
      `${this.projectsAPI}/${projectName}/map/${hashId}`,
      this.createHttpOptions(true),
    );
  }

  deletePDF(
    projectName,
    fileId,
  ): Observable<any> {
    const options = this.createHttpOptions(true);

    return this.http.request(
      'delete',
      `${this.projectsAPI}/${projectName}/files`,
      {
        body: [fileId],
        ...option,
      });
  }

  // TODO - no delete dir endpoint exist rignt now
  deleteDirectory(): Observable<any> {
    return null;
  }
}
