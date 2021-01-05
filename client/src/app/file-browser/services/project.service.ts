import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ProjectList } from '../models/project-list';
import { ResultList } from '../../interfaces/shared.interface';
import { Observable } from 'rxjs';
import { ProjectImpl } from '../models/filesystem-object';
import { ProjectCreateRequest, ProjectData, ProjectDataResponse, ProjectSearchRequest } from '../schema';
import { encode } from 'punycode';

@Injectable()
export class ProjectService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  list(): Observable<ProjectList> {
    return this.http.get<ResultList<ProjectData>>(
      `/api/projects/projects/`, this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.results.length;
        projectList.results.replace(data.results.map(
          itemData => new ProjectImpl().update(itemData)));
        return projectList;
      }),
    );
  }

  search(options: ProjectSearchRequest): Observable<ProjectList> {
    return this.http.post<ResultList<ProjectData>>(
      `/api/projects/search`,
      options,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.results.length;
        projectList.results.replace(data.results.map(
          itemData => new ProjectImpl().update(itemData)));
        return projectList;
      }),
    );
  }

  create(request: ProjectCreateRequest) {
    return this.http.post<ProjectDataResponse>(
      `/api/projects/projects/`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data.project)),
    );
  }

  get(hashId: string): Observable<ProjectImpl> {
    return this.http.get<ProjectData>(
      `/api/projects/projects/${encode(hashId)}`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data)),
    );
  }

}
