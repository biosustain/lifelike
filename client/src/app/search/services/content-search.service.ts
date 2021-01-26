import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { AnnotationRequestOptions, AnnotationResponse } from '../content-search';
import { RankedItem, ResultList, ResultQuery } from '../../shared/schemas/common';
import { ApiService } from '../../shared/services/api.service';
import { ContentSearchRequest } from '../schema';
import { ModelList } from '../../shared/models';
import { map } from 'rxjs/operators';
import { FilesystemObject } from '../../file-browser/models/filesystem-object';
import { FilesystemObjectData } from '../../file-browser/schema';

@Injectable()
export class ContentSearchService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

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
        resultList.collectionSize = data.results.length;
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
}
