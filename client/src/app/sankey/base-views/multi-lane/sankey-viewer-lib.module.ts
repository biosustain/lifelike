import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { SankeyModule } from '../../components/sankey/sankey.module';
import { MultiLaneBaseAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeyDetailsPanelModule } from '../../components/details-panel/sankey-details-panel.module';
import { MultiLaneBaseControllerService } from './services/multi-lane-base-controller.service';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { MultiLaneLayoutService } from './services/multi-lane-layout.service';
import { BaseControllerService } from '../../services/base-controller.service';
import { SankeyLinkDetailsComponent } from '../../components/details-panel/link-details.component';
import { SankeyMultiLaneLinkDetailsComponent } from './components/details-panel/link-details.component';

@NgModule({
  providers: [
    {
      provide: SankeyLayoutService,
      useExisting: MultiLaneLayoutService
    },
    {
      provide: BaseControllerService,
      useClass: MultiLaneBaseControllerService
    },
    {
      provide: SankeyLinkDetailsComponent,
      useClass: SankeyMultiLaneLinkDetailsComponent
    }
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
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
    RouterModule.forRoot([]),
    SankeyModule,
    SankeyDetailsPanelModule
  ]
})
export class MultiLaneBaseModule {
}
