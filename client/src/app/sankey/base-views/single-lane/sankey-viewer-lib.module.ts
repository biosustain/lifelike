import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { ViewBase } from 'app/sankey/interfaces';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from 'app/sankey/constants/DI';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeySingleLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { BaseControllerService } from '../../services/base-controller.service';
import { SingleLaneBaseControllerService } from './services/single-lane-base-controller.service';
import { SankeySingleLaneComponent } from './components/sankey/sankey.component';
import { SankeySingleLaneDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeySingleLaneDetailsPanelModule } from './components/details-panel/sankey-single-lane-details-panel.module';
import { SankeySelectionService } from '../../services/selection.service';
import { SankeyLegendComponent } from './components/legend/sankey-legend.component';

@NgModule({
  id: ViewBase.sankeySingleLane,
  providers: [
    SingleLaneBaseControllerService,
    {
      provide: BaseControllerService,
      useExisting: SingleLaneBaseControllerService,
    },
    SankeySelectionService,
    ClipboardService,
    // Core components substitution
    { provide: SANKEY_ADVANCED, useValue: SankeySingleLaneAdvancedPanelComponent },
    { provide: SANKEY_GRAPH, useValue: SankeySingleLaneComponent },
    { provide: SANKEY_DETAILS, useValue: SankeySingleLaneDetailsPanelComponent },
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    NgbAccordionModule,
    RouterModule.forChild([]),
    SankeySingleLaneDetailsPanelModule,
  ],
  declarations: [
    SankeySingleLaneAdvancedPanelComponent,
    SankeySingleLaneComponent,
    SankeyLegendComponent,
  ],
})
export class SingleLaneBaseModule {}
