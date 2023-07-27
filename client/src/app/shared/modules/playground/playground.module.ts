import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PlaygroundComponent } from './components/playground.component';
import { ChatCompletionsFormComponent } from './components/form/chat-completions-form/chat-completions-form.component';
import declarations from './components';
import { PlaygroundService } from './services/playground.service';
import { SharedModule } from '../../shared.module';

@NgModule({
  imports: [SharedModule],
  declarations,
  exports: [PlaygroundComponent],
  providers: [PlaygroundService],
})
export class PlaygroundModule {}
