import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UploadPayload, PdfFileUpload, UploadType } from 'app/interfaces/pdf-files.interface';

@Injectable({
  providedIn: 'root'
})
export class ProjectPageService {
  readonly projectsAPI = '/api/projects';

  // Length limits. Keep these in sync with the values in the backend code (/models folder)
  readonly filenameMaxLength = 200;
  readonly descriptionMaxLength = 2048;

  constructor(private http: HttpClient) {}

  /**
   * Create http options with authorization
   * header if boolean set to true
   * @param withJwt - boolean representing whether to return the options with a jwt
   */
  createHttpOptions(withJwt = false) {
    if (withJwt) {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
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
   * Return content of top level directory of project
   * @param projectName - name of project
   */
	projectRootDir(projectName): Observable<any> {
    return this.http.get<any>(
      `${this.projectsAPI}/${projectName}/directories`,
    	this.createHttpOptions(true)
    ).pipe(
      map(resp => resp.result)
    );
  }
  
  /**
   * Return content of a directory inside of a project
   * @param projectName - 
   * @param directoryId - 
   */
  getProjectDir(
  	projectName,
  	directoryId
  ): Observable<any> {
    return this.http.get<any>(
      `${this.projectsAPI}/${projectName}/directories/${directoryId}`,
    	this.createHttpOptions(true)    
    );
  }

  /** API for project space items */

  addMap(
    projectName,
    directoryId,
    label,
    description
  ): Observable<any> {
    return this.http.post<any>(
      `${this.projectsAPI}/${projectName}/map`,
      {
        label,
        description,
        directoryId
      },
      this.createHttpOptions(true)
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
    dirname
  ): Observable<any> {
    return this.http.post<any>(
      `${this.projectsAPI}/${projectName}/directories`,
      { dirname, parentDir },
    	this.createHttpOptions(true)    
    ).pipe(
      map(resp => resp.results)
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
    data: UploadPayload
  ): Observable<HttpEvent<PdfFileUpload>> {
    const formData: FormData = new FormData();

    formData.append('filename', data.filename.substring(0, this.filenameMaxLength));
    formData.append('file', data.files[0]);
    formData.append('directoryId', parentDir);

    const url = `${this.projectsAPI}/${projectName}/files`;
    const options = this.createHttpOptions(true);
    
    return this.http.post<PdfFileUpload>(
      url,
      formData,
      {
        ...options,
        observe: 'events',
        reportProgress: true,
      }
    );
    
    // TODO - handle file upload url
    // if (data.description && data.description.length > 0) {
    //   formData.append('description', data.description.substring(0, this.descriptionMaxLength));
    // }
    // if (data.type === UploadType.Files) {
    //   formData.append('file', data.files[0]);
    // } else {
    //   formData.append('url', data.url);
    // }
  }
}
