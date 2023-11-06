import { NgModule } from '@angular/core';

import { NgbDropdownModule, NgbModalModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { OpenPlaygroundComponent } from './components/open-playground/open-playground.component';
import { PlaygroundComponent } from './components/playground.component';
import ChatCompletionsFormModule from './modules/chat-completions-form';
import CompletionsFormModule from './modules/completions-form';
import PlaygroundShared from './modules/shared';
import { ChatGPT } from './services/ChatGPT';
import { PlaygroundService } from './services/playground.service';

const exports = [OpenPlaygroundComponent];

@NgModule({
  entryComponents: [PlaygroundComponent],
  imports: [
    PlaygroundShared,
    ChatCompletionsFormModule,
    CompletionsFormModule,
    NgbModalModule,
    NgbDropdownModule,
    NgbTooltipModule,
  ],
  declarations: [PlaygroundComponent, ...exports],
  exports,
  providers: [PlaygroundService, DynamicViewService, ChatGPT],
})
export class PlaygroundModule {}
