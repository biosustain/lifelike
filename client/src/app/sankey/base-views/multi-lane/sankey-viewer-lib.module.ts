import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { ViewBase } from 'app/sankey/interfaces';
import { SANKEY_ADVANCED, SANKEY_DETAILS, SANKEY_GRAPH } from 'app/sankey/constants/DI';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { MultiLaneBaseAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { MultiLaneBaseControllerService } from './services/multi-lane-base-controller.service';
import { BaseControllerService } from '../../services/base-controller.service';
import { SankeyMultiLaneDetailsPanelModule } from './components/details-panel/sankey-multi-lane-details-panel.module';
import { SankeyMutiLaneDetailsPanelComponent } from './components/details-panel/details-panel.component';
import { SankeyMultiLaneComponent } from './components/sankey/sankey.component';
import { SankeySelectionService } from '../../services/selection.service';
import { SankeyLegendComponent } from './components/legend/sankey-legend.component';

@NgModule({
  id: ViewBase.sankeyMultiLane,
  providers: [
    MultiLaneBaseControllerService,
    {
      provide: BaseControllerService,
      useExisting: MultiLaneBaseControllerService,
    },
    SankeySelectionService,
    ClipboardService,
    // Core components substitution
    { provide: SANKEY_ADVANCED, useValue: MultiLaneBaseAdvancedPanelComponent },
    { provide: SANKEY_GRAPH, useValue: SankeyMultiLaneComponent },
    { provide: SANKEY_DETAILS, useValue: SankeyMutiLaneDetailsPanelComponent },
  ],
  imports: [
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forChild([]),
    SankeyMultiLaneDetailsPanelModule,
  ],
  declarations: [
    MultiLaneBaseAdvancedPanelComponent,
    SankeyMultiLaneComponent,
    SankeyLegendComponent,
  ],
})
export class MultiLaneBaseModule {}
