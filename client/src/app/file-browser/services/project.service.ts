import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ProjectList } from '../models/project-list';
import { Observable } from 'rxjs';
import { ProjectImpl } from '../models/filesystem-object';
import {
  BulkProjectUpdateRequest,
  ProjectCreateRequest,
  ProjectData,
  ProjectSearchRequest,
} from '../schema';
import { encode } from 'punycode';
import { ResultList, ResultMapping, SingleResult } from '../../shared/schemas/common';

@Injectable()
export class ProjectService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  list(): Observable<ProjectList> {
    return this.http.get<ResultList<ProjectData>>(
      `/api/projects/projects`, this.apiService.getHttpOptions(true),
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
    return this.http.post<SingleResult<ProjectData>>(
      `/api/projects/projects`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data.result)),
    );
  }

  get(hashId: string): Observable<ProjectImpl> {
    return this.http.get<SingleResult<ProjectData>>(
      `/api/projects/projects/${encode(hashId)}`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data.result)),
    );
  }

  save(hashIds: string[], changes: Partial<BulkProjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: ProjectImpl }):
    Observable<{ [hashId: string]: ProjectImpl }> {
    return this.http.patch<ResultMapping<ProjectData>>(
      `/api/projects/projects`, {
        ...changes,
        hashIds,
      }, this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: ProjectImpl } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.results)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new ProjectImpl();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
    );
  }

}
