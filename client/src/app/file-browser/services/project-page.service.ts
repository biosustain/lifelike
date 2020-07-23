import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isNullOrUndefined } from 'util';
import { DirectoryContent } from '../../interfaces/projects.interface';
import { AbstractService } from '../../shared/services/abstract-service';
import { AuthenticationService } from '../../auth/services/authentication.service';

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class ProjectPageService extends AbstractService {
  readonly PROJECTS_BASE_URL = '/api/projects';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  // ========================================
  // Fetch
  // ========================================

  getDirectory(projectName, directoryId = null): Observable<DirectoryContent> {
    if (isNullOrUndefined(directoryId)) {
      return this.getRootDirectory(projectName);
    } else {
      return this.http.get<any>(
        `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/directories/${encodeURIComponent(directoryId)}`,
        this.getHttpOptions(true),
      ).pipe(
        map(resp => resp.result),
      );
    }
  }

  private getRootDirectory(projectName): Observable<DirectoryContent> {
    return this.http.get<DirectoryContent>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/directories`,
      this.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  // ========================================
  // CRUD
  // ========================================

  createDirectory(projectName, parentDir = null, dirname): Observable<any> {
    return this.http.post<any>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(projectName)}/directories`,
      {dirname, parentDir},
      this.getHttpOptions(true),
    ).pipe(
      map(resp => resp.results),
    );
  }

  // TODO - no delete dir endpoint exist rignt now
  deleteDirectory(): Observable<any> {
    throw new Error('not implemented');
  }
}
