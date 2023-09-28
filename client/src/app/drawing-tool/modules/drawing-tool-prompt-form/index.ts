import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { DrawingToolPromptFormComponent } from './drawing-tool-prompt-form.component';
import { EntitiesControlComponent } from './control/entities-control/entities-control.component';

export const exports = [DrawingToolPromptFormComponent];

@NgModule({
  imports: [SharedModule],
  exports,
  declarations: [...exports, EntitiesControlComponent],
})
export default class DrawingToolPromptFormModule {}
