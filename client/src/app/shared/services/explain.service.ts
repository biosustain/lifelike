import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SingleResult } from 'app/shared/schemas/common';

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
  root: string;
}

@Injectable({ providedIn: 'root' })
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
}
