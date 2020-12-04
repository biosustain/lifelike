import { Injectable } from '@angular/core';
import { ApiService } from '../../shared/services/api.service';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { ProjectList } from '../models/project-list';
import { ResultList } from '../../interfaces/shared.interface';
import { Observable } from 'rxjs';
import { ProjectImpl } from '../models/filesystem-object';
import {
  BulkProjectUpdateRequest,
  ProjectCreateRequest,
  ProjectData,
  ProjectDataResponse,
  ProjectSearchRequest,
} from '../schema';
import { encode } from 'punycode';
import { objectToMixedFormData } from '../../shared/utils/forms';
import { MultipleItemDataResponse } from '../../shared/schema/common';

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

  save(hashIds: string[], changes: Partial<BulkProjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: ProjectImpl }):
    Observable<{ [hashId: string]: ProjectImpl }> {
    return this.http.patch<MultipleItemDataResponse<ProjectData>>(
      `/api/projects/projects`, objectToMixedFormData({
        ...changes,
        hashIds,
      }), this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: ProjectImpl } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.items)) {
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
