import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable} from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectData, ProjectData } from 'app/file-browser/schema';
import { RankedItem, ResultList } from 'app/shared/schemas/common';
import { ApiService } from 'app/shared/services/api.service';

import {
  AnnotationRequestOptions,
  AnnotationResponse,
  ContentSearchRequest,
  SynonymSearchResponse,
} from '../schema';


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

  search(request: Record<keyof ContentSearchRequest, string>): Observable<ResultList<RankedItem<FilesystemObject>>> {
    return this.http.get<ResultList<RankedItem<FilesystemObjectData>>>(
      `/api/search/content`,
      {
        ...this.apiService.getHttpOptions(true),
        params: {
          ...request
        }
      },
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

  getSynoynms(searchTerm: string, organisms: string[], types: string[], page: number, limit: number): Observable<SynonymSearchResponse> {
    return this.http.get<SynonymSearchResponse>(
      `/api/search/synonyms`, {
        ...this.apiService.getHttpOptions(true),
        params: {
          term: searchTerm,
          organisms: organisms.join(';'),
          types: types.join(';'),
          page: page.toString(),
          limit: limit.toString(),
        }
      },
    );
  }
}
