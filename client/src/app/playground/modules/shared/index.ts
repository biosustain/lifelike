import { NgModule } from '@angular/core';

import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';

import { LogitBiasControlComponent } from './logit-bias-control/logit-bias-control.component';
import { ModelControlComponent } from './model-control/model-control.component';
import { StopControlComponent } from './stop-control/stop-control.component';
import { CostEstimateTooltipComponent } from './components/cost-estimate-tooltip.component';

export const exports = [
  CostEstimateTooltipComponent,
  LogitBiasControlComponent,
  ModelControlComponent,
  StopControlComponent,
];

@NgModule({
  imports: [SharedModule, NgbAccordionModule],
  exports: [...exports, SharedModule, NgbAccordionModule],
  declarations: [...exports],
})
export default class PlaygroundShared {}
