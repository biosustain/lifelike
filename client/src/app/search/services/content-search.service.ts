import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { FilesystemObject } from "app/file-browser/models/filesystem-object";
import { ProjectData } from "app/file-browser/schema";

import {
  AnnotationRequestOptions,
  AnnotationResponse,
  ContentSearchResponse,
  ContentSearchResponseData,
  SynonymSearchResponse,
} from "../schema";
import { ContentSearchQueryParameters } from "../utils/search";

@Injectable()
export class ContentSearchService {
  constructor(protected readonly http: HttpClient) {}

  // TODO: Use endpoint `'annotations/generate'` instead
  // then add an if block for mime_type?
  annotate(params: AnnotationRequestOptions): Observable<AnnotationResponse> {
    return this.http.post<AnnotationResponse>(
      `/api/filesystem/annotations/text/generate`,
      params
    );
  }

  search(
    request: ContentSearchQueryParameters
  ): Observable<ContentSearchResponse> {
    return this.http
      .get<ContentSearchResponseData>(`/api/search/content`, {
        params: {
          ...request,
        },
      })
      .pipe(
        map((data) => {
          return {
            total: data.total,
            results: data.results.map((itemData) => ({
              rank: itemData.rank,
              item: new FilesystemObject().update(itemData.item),
            })),
            query: data.query,
            droppedFolders: data.droppedFolders,
          };
        })
      );
  }

  getProjects(): Observable<ProjectData[]> {
    return this.http
      .get<{ results: ProjectData[] }>(`/api/projects/projects`, {})
      .pipe(map((resp) => resp.results));
  }

  getSynoynms(
    searchTerm: string,
    organisms: string[],
    types: string[],
    page: number,
    limit: number
  ): Observable<SynonymSearchResponse> {
    return this.http.get<SynonymSearchResponse>(`/api/search/synonyms`, {
      params: {
        term: searchTerm,
        organisms: organisms.join(";"),
        types: types.join(";"),
        page: page.toString(),
        limit: limit.toString(),
      },
    });
  }
}
