import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { PlaygroundModule } from 'app/playground/playground.module';

import { PromptComponent } from './components/prompt.component';
import declarations from './components';

@NgModule({
  entryComponents: [PromptComponent],
  imports: [PlaygroundModule, SharedModule],
  declarations,
  exports: [PromptComponent],
})
export class PromptModule {}
