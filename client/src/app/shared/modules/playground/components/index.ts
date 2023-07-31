import { CompletionsFormComponent } from './form/completions-form/completions-form.component';
import { ComposePromptFormComponent } from './form/compose-prompt-form/compose-prompt-form.component';
import { ChatCompletionsFormComponent } from './form/chat-completions-form/chat-completions-form.component';
import { PlaygroundComponent } from './playground.component';
import { FunctionsControlComponent } from './form/chat-completions-form/control/functions-control-form/functions-control.component';
import { MessagesControlComponent } from './form/chat-completions-form/control/messages-control/messages-control.component';
import { LogitBiasControlComponent } from './form/control/logit-bias-control/logit-bias-control.component';
import { ModelControlComponent } from './form/control/model-control/model-control.component';
import { StopControlComponent } from './form/control/stop-control/stop-control.component';

export default [
  PlaygroundComponent,
  CompletionsFormComponent,
  ChatCompletionsFormComponent,
  ComposePromptFormComponent,
  FunctionsControlComponent,
  MessagesControlComponent,
  LogitBiasControlComponent,
  ModelControlComponent,
  StopControlComponent
];
