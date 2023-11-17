import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { SingleResult } from 'app/shared/schemas/common';
import { ChatGPTResponse } from 'app/enrichment/services/enrichment-visualisation.service';

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

export interface GraphChatGPTResponse {
  graph: {
    nodes: {
      eid: string;
      displayName: string;
      type: string;
      entityType: string;
    }[];
    edges: {
      from: string;
      to: string;
      label: string;
    }[];
  };
  response: ChatGPTResponse;
}

@Injectable({ providedIn: '***ARANGO_USERNAME***' })
export class ExplainService {
  endpoint = '/api/explain/';

  constructor(protected readonly http: HttpClient) {}

  relationship(
    entities: Iterable<string>,
    context?: string,
    options: ExplainRelationshipOptions = {}
  ): Observable<ChatGPTResponse> {
    return this.http.post<ChatGPTResponse>(this.endpoint + 'relationship', {
      entities: Array.from(entities),
      context,
      options,
    });
  }

  relationshipGraph(
    entities: Iterable<string>,
    context?: string,
    options: ExplainRelationshipOptions = {}
  ): Observable<GraphChatGPTResponse> {
    return this.http
      .post<GraphChatGPTResponse>(this.endpoint + 'relationship/graph', {
        entities: Array.from(entities),
        context,
        options,
      })
      .pipe(tap((response) => console.log(response)));
  }
}
