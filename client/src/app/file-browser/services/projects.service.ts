import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map, startWith, switchMap } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';

import { PaginatedRequestOptions, ResultList, ResultMapping, SingleResult, } from 'app/shared/schemas/common';
import { ModelList } from 'app/shared/models';
import { serializePaginatedParams } from 'app/shared/utils/params';

import { ProjectList } from '../models/project-list';
import { ProjectImpl, FilesystemObject } from '../models/filesystem-object';
import {
  BulkProjectUpdateRequest,
  CollaboratorData,
  MultiCollaboratorUpdateRequest,
  ProjectCreateRequest,
  ProjectData,
  ProjectSearchRequest,
  FilesystemObjectData,
} from '../schema';
import { encode } from 'punycode';
import { Collaborator } from '../models/collaborator';

@Injectable()
export class ProjectsService {
  /**
   * The list of projects has been updated.
   */
  update$ = new Subject();

  constructor(protected readonly http: HttpClient) {}

  list(options?: PaginatedRequestOptions): Observable<ProjectList> {
    return this.update$.pipe(
      startWith(Date.now()),
      switchMap(() => this.http.get<ResultList<ProjectData>>(
          `/api/projects/projects`, {
            params: serializePaginatedParams(options, false),
          },
        ).pipe(
          map(data => {
            const projectList = new ProjectList();
            projectList.collectionSize = data.total;
            projectList.results.replace(data.results.map(
              itemData => new ProjectImpl().update(itemData)));
            return projectList;
          }),
        )
      )
    );
  }

  search(options: ProjectSearchRequest): Observable<ProjectList> {
    return this.http.post<ResultList<ProjectData>>(
      `/api/projects/search`,
      options,
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.total;
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
    ).pipe(
      map(data => new ProjectImpl().update(data.result)),
    );
  }

  get(hashId: string): Observable<ProjectImpl> {
    return this.http.get<SingleResult<ProjectData>>(
      `/api/projects/projects/${encode(hashId)}`,
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
      }
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: ProjectImpl } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new ProjectImpl();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
    );
  }

  getCollaborators(hashId: string, options: PaginatedRequestOptions = {}):
    Observable<ModelList<Collaborator>> {
    return this.http.get<ResultList<CollaboratorData>>(
      `/api/projects/projects/${hashId}/collaborators`, {
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => {
        const collaboratorsList = new ModelList<Collaborator>();
        collaboratorsList.collectionSize = data.results.length;
        collaboratorsList.results.replace(data.results.map(
          itemData => new Collaborator().update(itemData)));
        return collaboratorsList;
      }),
    );
  }

  saveCollaborators(hashId: string, request: MultiCollaboratorUpdateRequest):
    Observable<ModelList<Collaborator>> {
    return this.http.post<ResultList<CollaboratorData>>(
      `/api/projects/projects/${hashId}/collaborators`,
      request,
    ).pipe(
      map(data => {
        const collaboratorsList = new ModelList<Collaborator>();
        collaboratorsList.collectionSize = data.results.length;
        collaboratorsList.results.replace(data.results.map(
          itemData => new Collaborator().update(itemData)));
        return collaboratorsList;
      }),
    );
  }

  delete(
    hashId: string,
    updateWithLatest?: { [hashId: string]: FilesystemObject },
    reqursive = false,
  ):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.request<ResultMapping<FilesystemObjectData>>(
      'DELETE',
      `/api/projects/projects`, {
        headers: {'Content-Type': 'application/json'},
        body: {
          hashIds: [hashId],
          reqursive
        },
        responseType: 'json',
      },
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
          }
          ret[itemHashId].update(itemData);
        }
        this.update$.next();
        return ret;
      })
    );
  }
}
