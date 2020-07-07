import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';

import {map} from 'rxjs/operators';

import {
  FTSResult,
  PDFResult
} from 'app/interfaces';
import {AuthenticationService} from '../../auth/services/authentication.service';

@Injectable()
export class SearchService {
  readonly searchApi = '/api/search';

  constructor(private http: HttpClient,
              private auth: AuthenticationService) {
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

  pdfFullTextSearch(query: string, offset: number = 0, limit: number = 20) {
    const options = {
      headers: this.getAuthHeader(),
    };
    return this.http.post<{ result: PDFResult }>(
      `${this.searchApi}/pdf-search`, {query, offset, limit}, options
    ).pipe(map(resp => resp.result));
  }


  visualizerSearchTemp(query: string, page: number = 1, limit: number = 10, filter: string = 'labels(node)') {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/viz-search-temp`, {query, page, filter, limit},
    ).pipe(map(resp => resp.result));
  }

  private getAuthHeader() {
    return {Authorization: `Bearer ${this.auth.getAccessToken()}`};
  }
}
