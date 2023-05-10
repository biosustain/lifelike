import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SingleResult } from 'app/shared/schemas/common';

@Injectable({providedIn: '***ARANGO_USERNAME***'})
export class ExplainService {
  endpoint = '/api/explain/';

  constructor(protected readonly http: HttpClient) {
  }

  relationship(entities: Iterable<string>): Observable<string> {
    return this.http.post<SingleResult<string>>(
      this.endpoint + 'relationship',
      {entities: Array.from(entities)}
    ).pipe(
      map(({result}) => result)
    );
  }
}
