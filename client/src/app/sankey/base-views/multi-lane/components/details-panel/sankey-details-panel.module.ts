import { NgModule } from '@angular/core';

import { SankeyDetailsPanelModule } from 'app/sankey/components/details-panel/sankey-details-panel.module';
import { SharedModule } from 'app/shared/shared.module';

import { SankeyLinkDetailsComponent } from './link-details.component';
import { SankeyDetailsPanelComponent } from './details-panel.component';

@NgModule({
  declarations: [
    SankeyLinkDetailsComponent,
    SankeyDetailsPanelComponent,
  ],
  imports: [
    SankeyDetailsPanelModule,
    SharedModule
  ],
  exports: [
    SankeyDetailsPanelComponent
  ],
})
export class SankeyMultiLaneDetailsPanelModule {
}
