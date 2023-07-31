import { ChangeDetectorRef } from '@angular/core';

import { Observable } from 'rxjs';

import { CommonCompletitionsParams } from '../../ChatGPT';
import { WrappedRequest } from '../../interfaces';

export interface CompletionForm<Params extends CommonCompletitionsParams = CommonCompletitionsParams> {
  request: Observable<WrappedRequest<Params, any>>;
  params: Partial<Params & { prompt: string }>;
  cdr: ChangeDetectorRef
}
