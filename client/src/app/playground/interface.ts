import { Observable } from 'rxjs';

export interface PromptComposer {
  prompt$: Observable<string>;
}
