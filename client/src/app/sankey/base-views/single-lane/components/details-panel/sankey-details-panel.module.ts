import { NgModule } from '@angular/core';

import { SankeyDetailsPanelModule } from 'app/sankey/components/details-panel/sankey-details-panel.module';
import { SharedModule } from 'app/shared/shared.module';

import { SankeySingleLaneLinkDetailsComponent } from './link-details.component';
import { SankeySingleLaneDetailsPanelComponent } from './details-panel.component';

@NgModule({
  declarations: [
    SankeySingleLaneLinkDetailsComponent,
    SankeySingleLaneDetailsPanelComponent,
  ],
  imports: [
    SankeyDetailsPanelModule,
    SharedModule
  ],
  exports: [
    SankeySingleLaneDetailsPanelComponent
  ],
})
export class SankeySingleLaneDetailsPanelModule {
}
