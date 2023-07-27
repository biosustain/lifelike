import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared.module';
import { PromptComponent } from './components/prompt.component';
import { PlaygroundModule } from '../playground/playground.module';
import declarations from './components';

@NgModule({
  entryComponents: [PromptComponent],
  imports: [PlaygroundModule, SharedModule],
  declarations,
  exports: [PromptComponent],
})
export class PromptModule {}
