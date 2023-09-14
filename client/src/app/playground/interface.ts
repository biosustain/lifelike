import { Observable } from 'rxjs';

export interface PromptComposer {
  readonly prompt$: Observable<string>;
}
