import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { PlaygroundComponent } from './components/playground.component';
import declarations from './components';
import { DrawingToolPromptFormComponent } from './components/form/drawing-tool-prompt-form/drawing-tool-prompt-form.component';
import { ChatGPT } from './ChatGPT';
import form from './components/form';
import { AutoFillControlComponent } from './components/form/enrichment-prompt-form/control/auto-fill-control/auto-fill-control.component';
import { OpenPlaygroundComponent } from './components/open-playground/open-playground.component';

@NgModule({
  entryComponents: [DrawingToolPromptFormComponent, ...form],
  imports: [SharedModule],
  declarations,
  exports: [OpenPlaygroundComponent],
  providers: [DynamicViewService, ChatGPT],
})
export class PlaygroundModule {
  // Ideally we would not load this module in production
}
