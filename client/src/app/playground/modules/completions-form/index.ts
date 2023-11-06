import { NgModule } from '@angular/core';

import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { CompletionsFormComponent } from './completions-form.component';
import PlaygroundShared from '../shared';

const exports = [CompletionsFormComponent];

@NgModule({
  imports: [PlaygroundShared, NgbTooltipModule],
  exports,
  declarations: [...exports],
})
export default class CompletionsFormModule {}
