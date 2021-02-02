import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { RankedItem, ResultList } from 'app/shared/schemas/common';
import { AbstractService } from 'app/shared/services/abstract-service';

import { AnnotationRequestOptions, AnnotationResponse, Project } from '../content-search';

@Injectable()
export class ContentSearchService extends AbstractService {
  protected readonly SEARCH_BASE_URL = '/api/search';
  protected readonly PROJECTS_BASE_URL = '/api/projects';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  annotate(params: AnnotationRequestOptions): Observable<AnnotationResponse> {
    return this.http.post<AnnotationResponse>(
      `${this.SEARCH_BASE_URL}/annotate`,
      params, {
        ...this.getHttpOptions(true),
      },
    );
  }

  search(params): Observable<ResultList<RankedItem<DirectoryObject>>> {
    return this.http.get<ResultList<RankedItem<DirectoryObject>>>(
      `${this.SEARCH_BASE_URL}/content`, {
        ...this.getHttpOptions(true),
        params,
      },
    );
  }

  getProjects(): Observable<string[]> {
    return this.http.get<{results: Project[]}>(
      `${this.PROJECTS_BASE_URL}/`, {
        ...this.getHttpOptions(true),
      },
    ).pipe(map(resp => resp.results.map(project => project.projectName)));
  }
}
