import { Injectable } from '@angular/core';
import { AbstractService } from '../../shared/services/abstract-service';
import { ContentSearchOptions } from '../content-search';
import { RankedItem, ResultList } from '../../interfaces/shared.interface';
import { serializePaginatedParams } from '../../shared/utils/params';
import { Observable } from 'rxjs';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { AuthenticationService } from '../../auth/services/authentication.service';
import { HttpClient } from '@angular/common/http';

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
