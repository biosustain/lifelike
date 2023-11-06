import { NgModule } from '@angular/core';

import { NgbDropdownModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';

import { AutoFillControlComponent } from './control/auto-fill-control/auto-fill-control.component';
import { EnrichmentPromptFormComponent } from './enrichment-prompt-form.component';

const exports = [EnrichmentPromptFormComponent];

@NgModule({
  imports: [SharedModule, NgbDropdownModule, NgbTypeaheadModule],
  declarations: [...exports, AutoFillControlComponent],
  exports,
})
export default class EnrichmentPromptFormModule {}
