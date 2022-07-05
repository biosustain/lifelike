import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FlexLayoutModule } from '@angular/flex-layout';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { RouterModule } from '@angular/router';

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
      useExisting: MultiLaneBaseControllerService
    },
    SankeySelectionService,
    ClipboardService,
    // Core components substitution
    {provide: SANKEY_ADVANCED, useValue: MultiLaneBaseAdvancedPanelComponent},
    {provide: SANKEY_GRAPH, useValue: SankeyMultiLaneComponent},
    {provide: SANKEY_DETAILS, useValue: SankeyMutiLaneDetailsPanelComponent}
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatDialogModule,
    MatChipsModule,
    MatSelectModule,
    MatInputModule,
    FlexLayoutModule,
    MatButtonModule,
    MatRadioModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forChild([]),
    SankeyMultiLaneDetailsPanelModule
  ],
  declarations: [
    MultiLaneBaseAdvancedPanelComponent,
    SankeyMultiLaneComponent,
    SankeyLegendComponent
  ]
})
export class MultiLaneBaseModule {
}
