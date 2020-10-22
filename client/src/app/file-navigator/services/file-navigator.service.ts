import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { KnowledgeMap } from 'app/drawing-tool/services/interfaces';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable({
  providedIn: 'root'
})
export class FileNavigatorService extends AbstractService {
  readonly PROJECTS_BASE_URL = '/api/projects';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getAssociatedMaps(projectName: string, fileId: string): Observable<KnowledgeMap[]> {
    return this.http.get<KnowledgeMap[]>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(
        projectName
      )}/files/${encodeURIComponent(fileId)}/associated-maps`,
      this.getHttpOptions(true)
    );
  }

}
