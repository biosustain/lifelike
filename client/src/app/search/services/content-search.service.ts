import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { RankedItem, ResultList } from 'app/interfaces/shared.interface';
import { AbstractService } from 'app/shared/services/abstract-service';
import { serializePaginatedParams } from 'app/shared/utils/params';

import { ContentSearchOptions } from '../content-search';

@Injectable()
export class ContentSearchService extends AbstractService {
  protected readonly SEARCH_BASE_URL = '/api/search';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  search(params: ContentSearchOptions): Observable<ResultList<RankedItem<DirectoryObject>>> {
    return this.http.get<ResultList<RankedItem<DirectoryObject>>>(
      `${this.SEARCH_BASE_URL}/content`, {
        ...this.getHttpOptions(true),
        params: {
          ...serializePaginatedParams(params, false),
          q: params.q,
          types: params.types.map(value => value.id).join(';'),
          sort: params.sort,
          page: params.page + '',
          limit: params.limit + '',
        } as Record<keyof ContentSearchOptions, string>,
      },
    );
  }
}
