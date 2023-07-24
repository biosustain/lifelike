import { Directive } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';

export interface PromptComposer {
  prompt$: Observable<string>;
}

@Directive({
  selector: '[appPromptComposer]',
})
export abstract class PromptComposerDirective {
  abstract prompt$ : Observable<string>;
}
