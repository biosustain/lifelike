import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import { FTSResult } from 'app/interfaces';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable()
export class GraphSearchService extends AbstractService {
  readonly searchApi = '/api/search';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  // NOTE: Commenting out as these are unused...do we need these?
  // fullTextSearch(query: string, page: number = 1, limit: number = 10) {
  //   return this.http.post<{ result: FTSResult }>(
  //     `${this.searchApi}/search`,
  //     {query, page, limit},
  //     {...this.getHttpOptions(true)}
  //   ).pipe(map(resp => resp.result));
  // }

  // simpleFullTextSearch(query: string, page: number = 1, limit: number = 10, filter: string = 'labels(node)') {
  //   return this.http.post<{ result: FTSResult }>(
  //     `${this.searchApi}/simple-search`,
  //     {query, page, filter, limit},
  //     {...this.getHttpOptions(true)}
  //   ).pipe(map(resp => resp.result));
  // }

  visualizerSearchTemp(
      query: string,
      organism: string = '',
      page: number = 1,
      limit: number = 10,
      filter: string = 'labels(node)'
  ) {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/viz-search-temp`,
      {query, organism, page, filter, limit},
      {...this.getHttpOptions(true)}
    ).pipe(map(resp => resp.result));
  }

  getGenesFilteredByOrganism(query: string, organismId: string, filters: string) {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/genes_filtered_by_organism_and_others`,
      {query, organismId, filters},
      {...this.getHttpOptions(true)}
    ).pipe(map(resp => resp.result));
  }
}
