import { ChangeDetectorRef } from '@angular/core';

import { Observable } from 'rxjs';

import { AlternativeCompletitionsOptions } from '../../ChatGPT';
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
  Params extends AlternativeCompletitionsOptions = AlternativeCompletitionsOptions,
  Result = any
> {
  request: Observable<
    CompletionRequestWrapping<Params, Result> | CompletionRequestStream<Params, Result>
  >;
  params: Partial<CompletionFormProjectedParams>;
}
