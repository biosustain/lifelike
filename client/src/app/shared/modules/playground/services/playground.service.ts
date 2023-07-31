import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CompletitionsParams } from '../ChatGPT';

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

enum ChatRole {
  system = 'system',
  user = 'user',
  assistant = 'assistant',
  function = 'function',
}

export interface ChatResponseChoiceMessage {
  role: ChatRole;
  content: string;
}

export interface ChatResponseChoice {
  index: number;
  message: ChatResponseChoiceMessage;
  finish_reason: string;
}

export interface ChatCompletionsUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  choices: ChatResponseChoice[];
  usage: ChatCompletionsUsage;
}

export type OptionallyStreamedType<Options, Stramed, Response> = Options extends {
  stream: true;
}
  ? Stramed
  : Response;

@Injectable()
export class PlaygroundService {
  endpoint = '/api/playground/';

  constructor(protected readonly http: HttpClient) {}

  /**
   * Helper to compose completitions create call, taking into account possible stream
   * @param options
   * @private
   */
  private completionsCreateCall(options: CompletitionsParams) {
    return (endpoint) =>
      options.stream
        ? this.http.post(endpoint, options, {
            reportProgress: true,
            observe: 'events',
            responseType: 'text',
          })
        : this.http.post(endpoint, options, {
            responseType: 'json',
          });
  }

  completionsCreate(options: CompletitionsParams) {
    return this.completionsCreateCall(options)(this.endpoint + 'completions');
  }

  completionsModels() {
    return this.http.get<ChatGPTModel[]>(this.endpoint + 'completions/models');
  }

  chatCompletionsCreate(options: CompletitionsParams) {
    return this.completionsCreateCall(options)(this.endpoint + 'chat/completions') as Observable<
      OptionallyStreamedType<
        CompletitionsParams,
        HttpEvent<ChatCompletionsResponse>,
        ChatCompletionsResponse
      >
    >;
  }

  chatCompletionsModels() {
    return this.http.get<ChatGPTModel[]>(this.endpoint + 'chat/completions/models');
  }

  models() {
    return this.http.get<ChatGPTModel[]>(this.endpoint + 'models');
  }
}
