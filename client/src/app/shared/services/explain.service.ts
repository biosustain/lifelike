import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SingleResult } from 'app/shared/schemas/common';

import { CompletitionsParams } from '../components/prompt/ChatGPT';

interface ExplainRelationshipOptions {
  temperature?: number;
}

interface ModelPermission {
  allow_create_engine: boolean;
  allow_fine_tuning: boolean;
  allow_logprobs: boolean;
  allow_sampling: boolean;
  allow_search_indices: boolean;
  allow_view: boolean;
  created: number;
  group: null;
  id: string;
  is_blocking: boolean;
  object: string;
  organization: string;
}

export interface ChatGPTModel {
  id: string;
  object: string;
  owned_by: string;
  permission: ModelPermission[];
  created: number;
  parent: null;
  ***ARANGO_USERNAME***: string;
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
        context,
        options,
      })
      .pipe(map(({ result }) => result));
  }

  playground(options: CompletitionsParams) {
    return this.http.post<any>(
      this.endpoint + 'playground',
      options,
      options.stream
        ? {
            reportProgress: true,
            observe: 'events',
            responseType: 'text',
          }
        : ({
            responseType: 'json',
          } as any)
    );
  }

  models() {
    return this.http.get<ChatGPTModel[]>(this.endpoint + 'models');
  }
}
