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
import { SANKEY_ADVANCED, SANKEY_GRAPH } from 'app/sankey/DI';

import { SankeySingleLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SingleLaneLayoutService } from './services/single-lane-layout.service';
import { BaseControllerService } from '../../services/base-controller.service';
import { SingleLaneBaseControllerService } from './services/single-lane-base-controller.service';
import { SankeyLinkDetailsComponent } from '../../components/details-panel/link-details.component';
import { SingleLaneLinkDetailsComponent } from './components/details-panel/link-details.component';
import { LayoutService } from '../../services/layout.service';
import { SankeySingleLaneComponent } from './components/sankey/sankey.component';

@NgModule({
  id: ViewBase.sankeySingleLane,
  providers: [
    SingleLaneBaseControllerService,
    {
      provide: BaseControllerService,
      useExisting: SingleLaneBaseControllerService
    },
    SingleLaneLayoutService,
    {
      provide: LayoutService,
      useExisting: SingleLaneLayoutService
    },
    {
      provide: SankeyLinkDetailsComponent,
      useExisting: SingleLaneLinkDetailsComponent
    },
    // Core components substitution
    {provide: SANKEY_ADVANCED, useValue: SankeySingleLaneAdvancedPanelComponent},
    {provide: SANKEY_GRAPH, useValue: SankeySingleLaneComponent},
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
    SingleLaneLinkDetailsComponent,
    SankeySingleLaneAdvancedPanelComponent,
    SankeySingleLaneComponent
  ]
})
export class SankeySingleLaneOverwriteModule {
}
