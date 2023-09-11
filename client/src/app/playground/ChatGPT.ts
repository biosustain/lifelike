import { Injectable } from '@angular/core';

import { find as _find, map as _map } from 'lodash/fp';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { ChatGPTModel, ExplainService } from 'app/shared/services/explain.service';

import { PlaygroundService } from './services/playground.service';

export interface CompletionOptions {
  prompt: string;
  echo: boolean;
  bestOf: number;
  n: number;
  maxTokens: number;
  model: string;
  stream: boolean;
}

export interface ChatCompletionMessageOptions {
  role: string;
  content: string;
  name?: string;
  functionCall?: Record<string, any>;
}

export interface ChatCompletionOptions {
  messages: any[];
  echo: boolean;
  bestOf: number;
  n: number;
  maxTokens: number;
  model: string;
  stream: boolean;
}
export type AlternativeCompletionOptions = CompletionOptions | ChatCompletionOptions;

@Injectable()
export class ChatGPT {
  constructor(private readonly playgroundService: PlaygroundService) {}
  static readonly DELIMITER = '```';

  // https://openai.com/pricing
  static readonly lastUpdate = new Date('2023-08-10');
  static readonly modelGroupTokenCostMap = new Map<string, (model: string) => number>([
    ['ada', (model) => (model.includes('embedding') ? 0.0001 / 1e3 : 0.0016 / 1e3)],
    ['babbage', () => 0.0024 / 1e3],
    ['curie', () => 0.012 / 1e3],
    ['davinci', () => 0.12 / 1e3],
    ['gpt-3.5-turbo', (model) => (model.includes('16K') ? 0.004 / 1e3 : 0.002 / 1e3)],
    ['whisper', () => 0.006 / 1e3],
  ]);

  static readonly completions = class Completions {
    static estimateRequestTokens({ prompt = '', echo, bestOf, n, maxTokens }: CompletionOptions) {
      const promptTokens = ChatGPT.textTokenEstimate(prompt);
      return [
        promptTokens + promptTokens * bestOf + Number(echo) * promptTokens,
        promptTokens + maxTokens * bestOf + Number(echo) * promptTokens,
      ];
    }
  };

  static readonly chatCompletions = class ChatCompletions {
    static estimateRequestTokens({ messages, n, maxTokens }: ChatCompletionOptions) {
      const messageTokens = messages.reduce(
        (acc, { content }) => acc + ChatGPT.textTokenEstimate(content),
        0
      );
      return [messageTokens + messageTokens * n, messageTokens + maxTokens * n];
    }
  };

  public readonly models$: Observable<string[]> = this.playgroundService
    .models()
    .pipe(
      map(_map((model: ChatGPTModel) => model.id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  static escape = (text: string) => text.replace(ChatGPT.DELIMITER, '[ignored]');

  // https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
  static textTokenEstimate = (text: string) => Math.ceil((text.split(' ').length * 4) / 3);

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

  static estimateCost(model: string, tokenEstimates: number[]) {
    const modelCost = ChatGPT.getModelTokenCost(model);
    return _map((tokens) => tokens * modelCost, tokenEstimates);
  }
}
