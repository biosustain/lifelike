import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ProjectData } from 'app/file-browser/schema';
import { ApiService } from 'app/shared/services/api.service';

import {
  AnnotationRequestOptions,
  AnnotationResponse,
  ContentSearchRequest,
  ContentSearchResponse,
  ContentSearchResponseData
} from '../schema';
import { SynonymData } from '../shared';


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

  getSynoynms(): Observable<SynonymData[]> {
    // TODO: Implement service!
    return of([
      {type: 'Gene', description: 'alae sublatae', organism: 'fruit fly', aliases: ['als', 'ALS', 'Mps1']},
      {
        type: 'Gene', description: 'nicotinic Acetylcholine Receptor alpha1', organism: 'fruit fly', aliases: [
        'nAChRalpha1', 'Dmel_CG5610', 'AChRalpha1', 'ALS', 'ALs', 'Acr96A', 'Acr96Aa', 'AcrB']
      },
      {type: 'Gene', description: 'superoxide dismutase 1', organism: 'human', aliases: [
        'SOD1', 'ALS', 'ALS1', 'HEL-S-44', 'IPOA', 'SOD', 'STAHP', 'hSod1', 'homodimer']
      },
      {type: 'Gene', description: 'insulin like growth factor binding protein acid labile subunit', organism: 'human', aliases: [
        'GFALS', 'ACLSD', 'ALS']
      },
      {type: 'Disease', description: '<Primary Name>', organism: 'N/A', aliases: [
        'ALS', 'Amyotrophic Lateral Sclerosis', `Gehrig's Disease`]
      },
    ]);
  }
}
