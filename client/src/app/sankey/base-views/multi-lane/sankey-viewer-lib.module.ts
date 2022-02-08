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
import { SANKEY_ADVANCED } from 'app/sankey/DI';

import { MultiLaneBaseAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { MultiLaneBaseControllerService } from './services/multi-lane-base-controller.service';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { MultiLaneLayoutService } from './services/multi-lane-layout.service';
import { BaseControllerService } from '../../services/base-controller.service';
import { SankeyLinkDetailsComponent } from '../../components/details-panel/link-details.component';
import { SankeyMultiLaneLinkDetailsComponent } from './components/details-panel/link-details.component';
import { LayoutService } from '../../services/layout.service';

@NgModule({
  id: ViewBase.sankeyMultiLane,
  providers: [
    MultiLaneBaseControllerService,
    {
      provide: BaseControllerService,
      useExisting: MultiLaneBaseControllerService
    },
    MultiLaneLayoutService,
    {
      provide: SankeyLayoutService,
      useExisting: MultiLaneLayoutService
    },
    {
      provide: LayoutService,
      useExisting: MultiLaneLayoutService
    },
    {
      provide: SankeyLinkDetailsComponent,
      useExisting: SankeyMultiLaneLinkDetailsComponent
    },
    // Core components substitution
    {provide: SANKEY_ADVANCED, useValue: MultiLaneBaseAdvancedPanelComponent}
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
    RouterModule.forChild([])
  ],
  declarations: [
    MultiLaneBaseAdvancedPanelComponent
  ]
})
export class MultiLaneBaseModule {
}
