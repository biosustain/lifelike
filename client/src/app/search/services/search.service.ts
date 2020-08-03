import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import { FTSResult } from 'app/interfaces';

@Injectable()
export class SearchService {
  readonly searchApi = '/api/search';

  constructor(private http: HttpClient) {
  }

  fullTextSearch(query: string, page: number = 1, limit: number = 10) {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/search`, {query, page, limit},
    ).pipe(map(resp => resp.result));
  }

  simpleFullTextSearch(query: string, page: number = 1, limit: number = 10, filter: string = 'labels(node)') {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/simple-search`, {query, page, filter, limit},
    ).pipe(map(resp => resp.result));
  }

  visualizerSearchTemp(query: string, page: number = 1, limit: number = 10, filter: string = 'labels(node)') {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/viz-search-temp`, {query, page, filter, limit},
    ).pipe(map(resp => resp.result));
  }

  getGenesFilteredByOrganism(query: string, organismId: string, filters: string) {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/genes_filtered_by_organism_and_others`,
      {query, organismId, filters},
    ).pipe(map(resp => resp.result));
  }
}
