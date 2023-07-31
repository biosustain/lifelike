import { ChangeDetectorRef } from '@angular/core';

import { Observable } from 'rxjs';

import { AlternativeCompletitionsParams } from '../../ChatGPT';
import { WrappedRequest } from '../../interfaces';

export interface CompletionFormProjectedParams {
  prompt: string;
  temperature: number;
}

export interface CompletionForm<
  Params extends AlternativeCompletitionsParams = AlternativeCompletitionsParams
> {
  request: Observable<WrappedRequest<Params, any>>;
  params: Partial<CompletionFormProjectedParams>;
  cdr: ChangeDetectorRef;
}
