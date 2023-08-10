import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { DynamicViewService } from 'app/shared/services/dynamic-view.service';

import { PlaygroundComponent } from './components/playground.component';
import declarations from './components';
import { PlaygroundService } from './services/playground.service';
import { DrawingToolPromptFormComponent } from './components/form/drawing-tool-prompt-form/drawing-tool-prompt-form.component';
import { ChatGPT } from './ChatGPT';
import form from './components/form';
import { AutoFillControlComponent } from './components/form/enrichment-prompt-form/control/auto-fill-control/auto-fill-control.component';
import { OpenPlaygroundComponent } from './components/open-playground/open-playground.component';
import { EnrichmentPromptFormComponent } from './components/form/enrichment-prompt-form/enrichment-prompt-form.component';

@NgModule({
  entryComponents: [DrawingToolPromptFormComponent, EnrichmentPromptFormComponent],
  imports: [SharedModule],
  declarations,
  exports: [PlaygroundComponent, OpenPlaygroundComponent, DrawingToolPromptFormComponent, EnrichmentPromptFormComponent],
  providers: [PlaygroundService, DynamicViewService, ChatGPT],
})
export class PlaygroundModule {}
