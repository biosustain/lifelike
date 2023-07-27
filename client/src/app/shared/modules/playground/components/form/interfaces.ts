import { Observable } from 'rxjs';

import { CompletitionsParams } from '../../ChatGPT';
import { WrappedRequest } from '../../interfaces';

export interface CompletionForm {
  request: Observable<WrappedRequest<any, any>>;
}
