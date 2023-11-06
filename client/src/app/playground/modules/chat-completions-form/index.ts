import { NgModule } from '@angular/core';

import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

import { ChatCompletionsFormComponent } from './chat-completions-form.component';
import PlaygroundShared from '../shared';
import { FunctionsControlComponent } from './control/functions-control-form/functions-control.component';
import { MessagesControlComponent } from './control/messages-control/messages-control.component';

const exports = [ChatCompletionsFormComponent];

@NgModule({
  imports: [PlaygroundShared, NgbDropdownModule, NgbTooltipModule],
  exports,
  declarations: [FunctionsControlComponent, MessagesControlComponent, ...exports],
})
export default class ChatCompletionsFormModule {}
