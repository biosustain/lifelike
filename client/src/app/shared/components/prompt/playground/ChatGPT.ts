import { Injectable } from '@angular/core';

import {
  difference as _difference,
  flow as _flow,
  groupBy as _groupBy,
  identity as _identity,
  isEmpty as _isEmpty,
  isInteger as _isInteger,
  keys as _keys,
  map as _map,
  mapValues as _mapValues,
  omit as _omit,
  sortBy as _sortBy,
  find as _find,
} from 'lodash/fp';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { ChatGPTModel, ExplainService } from '../../../services/explain.service';

interface CompletitionsTokenParams {
  prompt: string;
  echo: boolean;
  bestOf: number;
  n: number;
  maxTokens: number;
}

export interface CompletitionsParams extends CompletitionsTokenParams {
  model: string;
  stream: boolean;
}

@Injectable()
export class ChatGPT {

  constructor(private readonly explainService: ExplainService) {}

  static lastUpdate = new Date(2023, 7, 17);

  static modelGroupTokenCostMap = new Map<string, (model: string) => number>([
    ['ada', (model) => (model.includes('v2') ? 0.0001 / 1e3 : 0.0016 / 1e3)],
    ['babbage', () => 0.0024 / 1e3],
    ['curie', () => 0.012 / 1e3],
    ['davinci', () => 0.12 / 1e3],
    ['gpt-3.5-turbo', (model) => (model.includes('16K') ? 0.004 / 1e3 : 0.002 / 1e3)],
    ['whisper', () => 0.006 / 1e3],
  ]);

  models$: Observable<string[]> = this.explainService
    .models()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  static getModelGroup(id: string) {
    return (
      _find(
        (group) => id.includes(group),
        ['ada', 'babbage', 'curie', 'davinci', 'gpt-3.5-turbo', 'whisper']
      ) || 'other'
    );
  }

  static getModelTokenCost(model: string) {
    return ChatGPT.modelGroupTokenCostMap.get(ChatGPT.getModelGroup(model))?.(model);
  }

  static estimateRequestTokens({ prompt, echo, bestOf, n, maxTokens }: CompletitionsTokenParams) {
    // https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
    const promptTokens = Math.ceil((prompt.split(' ').length * 4) / 3);
    return [
      promptTokens + promptTokens * bestOf + Number(echo) * promptTokens,
      promptTokens + maxTokens * bestOf + Number(echo) * promptTokens,
    ];
  }

  static estimateCost({ model, ...rest }: CompletitionsParams) {
    const modelCost = ChatGPT.getModelTokenCost(model);
    return _map((tokens) => tokens * modelCost, ChatGPT.estimateRequestTokens(rest));
  }
}
