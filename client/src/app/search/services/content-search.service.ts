import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ProjectData } from 'app/file-browser/schema';
import { ApiService } from 'app/shared/services/api.service';

import {
  AnnotationRequestOptions,
  AnnotationResponse,
  ContentSearchRequest,
  ContentSearchResponse,
  ContentSearchResponseData
} from '../schema';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';


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

  search(request: ContentSearchRequest): Observable<ContentSearchResponse> {
    return this.http.post<ContentSearchResponseData>(
      `/api/search/content`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        return {
          total: data.total,
          results: data.results.map(
            itemData => ({
              rank: itemData.rank,
              item: new FilesystemObject().update(itemData.item)
          })),
          query: data.query,
          synonyms: data.synonyms,
          droppedSynonyms: data.droppedSynonyms
        };
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
