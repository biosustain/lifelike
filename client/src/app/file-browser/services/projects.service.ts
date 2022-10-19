import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map, startWith, switchMap } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';

import { PaginatedRequestOptions, ResultList, ResultMapping, SingleResult, } from 'app/shared/schemas/common';
import { ModelList } from 'app/shared/models';
import { serializePaginatedParams } from 'app/shared/utils/params';
import GraphNS from 'app/shared/providers/graph-type/interfaces';

import { ProjectList } from '../models/project-list';
import { FilesystemObject } from '../models/filesystem-object';
import {
  BulkProjectUpdateRequest,
  CollaboratorData,
  MultiCollaboratorUpdateRequest,
  ProjectCreateRequest,
  ProjectSearchRequest,
  FilesystemObjectData,
} from '../schema';
import { encode } from 'punycode';
import { Collaborator } from '../models/collaborator';
import File = GraphNS.File;

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
      switchMap(() => this.http.get<ResultList<FilesystemObjectData>>(
          `/api/filesystem/objects`, {
            params: serializePaginatedParams(options, false),
          },
        ).pipe(
          map(data => {
            const projectList = new ProjectList(
              data.results.map(itemData => new FilesystemObject().update(itemData))
            );
            projectList.collectionSize = data.total;
            return projectList;
          }),
        )
      )
    );
  }

  search(options: ProjectSearchRequest): Observable<ProjectList> {
    return this.http.post<ResultList<FilesystemObjectData>>(
      `/api/filesystem/search`,
      options,
    ).pipe(
      map(data => {
        const projectList = new ProjectList(
          data.results.map(itemData => new FilesystemObject().update(itemData))
        );
        projectList.collectionSize = data.total;
        return projectList;
      }),
    );
  }

  create(request: ProjectCreateRequest) {
    return this.http.post<SingleResult<FilesystemObjectData>>(
      `/api/filesystem/objects`,
      request,
    ).pipe(
      map(data => new FilesystemObject().update(data.result)),
    );
  }

  get(hashId: string): Observable<FilesystemObject> {
    return this.http.get<SingleResult<FilesystemObjectData>>(
      `/api/filesystem/objects/${encode(hashId)}`,
    ).pipe(
      map(data => new FilesystemObject().update(data.result)),
    );
  }

  save(hashIds: string[], changes: Partial<BulkProjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.http.patch<ResultMapping<FilesystemObjectData>>(
      `/api/filesystem/objects`, {
        ...changes,
        hashIds,
      }
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: FilesystemObject } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new FilesystemObject();
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
      `/api/filesystem/objects`, {
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
