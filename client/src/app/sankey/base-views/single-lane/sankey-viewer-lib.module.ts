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
import { SankeySearchPanelModule } from 'app/sankey/components/search-panel/sankey-search-panel.module';

import { SankeySingleLaneModule } from './components/sankey/sankey.module';
import { SankeySingleLaneAdvancedPanelComponent } from './components/advanced-panel/advanced-panel.component';
import { SankeySingleLaneDetailsPanelModule } from './components/details-panel/sankey-details-panel.module';
import { SankeyLayoutService } from '../../components/sankey/sankey-layout.service';
import { SingleLaneLayoutService } from './services/single-lane-layout.service';
import { BaseControllerService } from '../../services/base-controller.service';
import { SingleLaneBaseControllerService } from './services/single-lane-base-controller.service';
import { SankeyLinkDetailsComponent } from '../../components/details-panel/link-details.component';
import { SingleLaneLinkDetailsComponent } from './components/details-panel/link-details.component';

@NgModule({
  providers: [
    {
      provide: SankeyLayoutService,
      useExisting: SingleLaneLayoutService
    },
    {
      provide: BaseControllerService,
      useClass: SingleLaneBaseControllerService
    },
    {
      provide: SankeyLinkDetailsComponent,
      useClass: SingleLaneLinkDetailsComponent
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
    SankeySingleLaneModule,
    SankeySingleLaneDetailsPanelModule,
    SankeySearchPanelModule
  ],
})
export class SankeySingleLaneOverwriteModule {
}
