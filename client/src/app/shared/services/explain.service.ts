import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SingleResult } from 'app/shared/schemas/common';

interface ExplainRelationshipOptions {
  temperature?: number;
}

@Injectable({ providedIn: '***ARANGO_USERNAME***' })
export class ExplainService {
  endpoint = '/api/explain/';

  constructor(protected readonly http: HttpClient) {}

  relationship(
    entities: Iterable<string>,
    context?: string,
    options: ExplainRelationshipOptions = {}
  ): Observable<string> {
    return this.http
      .post<SingleResult<string>>(this.endpoint + 'relationship', {
        entities: Array.from(entities),
        in: context,
        options,
      })
      .pipe(map(({ result }) => result));
  }

  playground(options) {
    return this.http.post(this.endpoint + 'playground', options);
  }
}
