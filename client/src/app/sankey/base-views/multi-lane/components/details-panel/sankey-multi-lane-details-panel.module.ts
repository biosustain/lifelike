import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SankeyDetailsPanelModule } from 'app/sankey/components/details-panel/sankey-details-panel.module';

import { SankeyMutiLaneDetailsPanelComponent } from './details-panel.component';
import { SankeyMultiLaneLinkDetailsComponent } from './link-details.component';

@NgModule({
  declarations: [
    SankeyMutiLaneDetailsPanelComponent,
    SankeyMultiLaneLinkDetailsComponent
  ],
  imports: [
    CommonModule,
    SankeyDetailsPanelModule
  ],
  exports: [
    SankeyMutiLaneDetailsPanelComponent
  ],
})
export class SankeyMultiLaneDetailsPanelModule {
}
