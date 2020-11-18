import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { KnowledgeMap } from 'app/drawing-tool/services/interfaces';
import { AbstractService } from 'app/shared/services/abstract-service';
import { PdfFile } from '../../interfaces/pdf-files.interface';

@Injectable({
  providedIn: 'root',
})
export class FileNavigatorService extends AbstractService {
  readonly PROJECTS_BASE_URL = '/api/projects';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getAssociatedMaps(projectName: string, fileId: string): Observable<AssociatedMapsResponse> {
    return this.http.get<AssociatedMapsResponse>(
      `${this.PROJECTS_BASE_URL}/${encodeURIComponent(
        projectName,
      )}/files/${encodeURIComponent(fileId)}/associated-maps`,
      this.getHttpOptions(true),
    );
  }

}

export interface AssociatedMapsResponse {
  file: PdfFile;
  results: KnowledgeMap[];
}
