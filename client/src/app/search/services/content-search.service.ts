import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectData, ProjectData } from 'app/file-browser/schema';
import { ModelList } from 'app/shared/models';
import { RankedItem, ResultList } from 'app/shared/schemas/common';
import { ApiService } from 'app/shared/services/api.service';

import { AnnotationRequestOptions, AnnotationResponse, ContentSearchRequest } from '../schema';


@Injectable()
export class ContentSearchService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  // TODO: Use endpoint `'annotations/generate'` instead
  // then add an if block for mime_type?
  annotate(params: AnnotationRequestOptions): Observable<AnnotationResponse> {
    return this.http.post<AnnotationResponse>(
      `/api/filesystem/annotations/text/generate`,
      params,
      this.apiService.getHttpOptions(true),
    );
  }

  search(request: ContentSearchRequest): Observable<ModelList<RankedItem<FilesystemObject>>> {
    return this.http.post<ResultList<RankedItem<FilesystemObjectData>>>(
      `/api/search/content`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const resultList: ModelList<RankedItem<FilesystemObject>> = new ModelList();
        resultList.collectionSize = data.total;
        resultList.results.replace(data.results.map(
          itemData => ({
            rank: itemData.rank,
            item: new FilesystemObject().update(itemData.item),
          })));
        resultList.query = data.query;
        return resultList;
      }),
    );
  }

  getProjects(): Observable<ProjectData[]> {
    return this.http.get<{results: ProjectData[]}>(
      `/api/projects/projects`, {
        ...this.apiService.getHttpOptions(true),
      },
    ).pipe(map(resp => resp.results));
  }
}
