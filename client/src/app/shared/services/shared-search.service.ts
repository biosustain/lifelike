import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import {
  OrganismsResult,
} from 'app/interfaces';

@Injectable()
export class SharedSearchService {
  readonly searchApi = '/api/search';

  constructor(private http: HttpClient) {
  }

  getOrganisms(query: string, limit: number = 50) {
    return this.http.post<{ result: OrganismsResult }>(
      `${this.searchApi}/organisms`, {query, limit},
    ).pipe(map(resp => resp.result));
  }
}
