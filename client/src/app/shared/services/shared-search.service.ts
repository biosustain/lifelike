import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from './abstract-service';

@Injectable()
export class SharedSearchService extends AbstractService {
  readonly searchApi = '/api/search';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getOrganismFromTaxId(organismTaxId: string) {
    return this.http.get<{ result: OrganismAutocomplete}>(
      `${this.searchApi}/organism/${organismTaxId}`,
      {...this.getHttpOptions(true)}
    ).pipe(map(resp => resp.result));
  }

  getOrganisms(query: string, limit: number = 50) {
    return this.http.post<{ result: OrganismsResult }>(
      `${this.searchApi}/organisms`,
      {query, limit},
      {...this.getHttpOptions(true)}
    ).pipe(map(resp => resp.result));
  }
}
