import { NgModule } from '@angular/core';

import { CompletionsFormComponent } from './completions-form.component';
import PlaygroundShared from '../shared';

const exports = [CompletionsFormComponent];

@NgModule({
  imports: [PlaygroundShared],
  exports,
  declarations: [...exports],
})
export default class CompletionsFormModule {}
