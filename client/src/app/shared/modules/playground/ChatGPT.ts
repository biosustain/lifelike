import { find as _find, map as _map } from 'lodash/fp';

export interface CompletitionsOptions {
  prompt: string;
  echo: boolean;
  bestOf: number;
  n: number;
  maxTokens: number;
  model: string;
  stream: boolean;
}

export interface ChatCompletitionsMessageOptions {
  role: string;
  content: string;
  name?: string;
  functionCall?: Record<string, any>;
}

export interface ChatCompletitionsOptions {
  messages: any[];
  echo: boolean;
  bestOf: number;
  n: number;
  maxTokens: number;
  model: string;
  stream: boolean;
}
export type AlternativeCompletitionsOptions = CompletitionsOptions | ChatCompletitionsOptions;

export class ChatGPT {
  static lastUpdate = new Date(2023, 7, 17);

  static modelGroupTokenCostMap = new Map<string, (model: string) => number>([
    ['ada', (model) => (model.includes('v2') ? 0.0001 / 1e3 : 0.0016 / 1e3)],
    ['babbage', () => 0.0024 / 1e3],
    ['curie', () => 0.012 / 1e3],
    ['davinci', () => 0.12 / 1e3],
    ['gpt-3.5-turbo', (model) => (model.includes('16K') ? 0.004 / 1e3 : 0.002 / 1e3)],
    ['whisper', () => 0.006 / 1e3],
  ]);

  static readonly completions = class Completions {
    static estimateRequestTokens({ prompt = '', echo, bestOf, n, maxTokens }: CompletitionsOptions) {
      const promptTokens = ChatGPT.textTokenEstimate(prompt);
      return [
        promptTokens + promptTokens * bestOf + Number(echo) * promptTokens,
        promptTokens + maxTokens * bestOf + Number(echo) * promptTokens,
      ];
    }
  };

  static readonly chatCompletions = class ChatCompletions {
    static estimateRequestTokens(
      { messages, n, maxTokens }: ChatCompletitionsOptions
    ) {
      const messageTokens = messages.reduce(
        (acc, { content }) => acc + ChatGPT.textTokenEstimate(content),
        0
      );
      return [
        messageTokens + messageTokens * n,
        messageTokens + maxTokens * n,
      ];
    }
  };

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
