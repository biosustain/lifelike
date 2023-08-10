import { ChangeDetectorRef } from '@angular/core';

import { Observable } from 'rxjs';

import { AlternativeCompletionOptions } from '../../ChatGPT';
import {
  CompletionRequest,
  CompletionRequestStream,
  CompletionRequestWrapping,
} from '../../interfaces';

export interface CompletionFormProjectedParams {
  prompt: string;
  temperature: number;
}

export interface CompletionForm<
  Params extends AlternativeCompletionOptions = AlternativeCompletionOptions,
  Result = any
> {
  request: Observable<
    CompletionRequestWrapping<Params, Result> | CompletionRequestStream<Params, Result>
  >;
  params: Partial<CompletionFormProjectedParams>;
}
