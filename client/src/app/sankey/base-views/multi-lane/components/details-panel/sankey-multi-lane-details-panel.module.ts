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

import { SankeyDetailsPanelModule } from 'app/sankey/abstract/entity-details/sankey-details-panel.module';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { SankeyMutiLaneDetailsPanelComponent } from './details-panel.component';
import { SankeyMultiLaneLinkDetailsComponent } from './link-details.component';

@NgModule({
  declarations: [
    SankeyMutiLaneDetailsPanelComponent,
    SankeyMultiLaneLinkDetailsComponent
  ],
  imports: [
    CommonModule,
    SankeyDetailsPanelModule,
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
  exports: [
    SankeyMutiLaneDetailsPanelComponent
  ],
})
export class SankeyMultiLaneDetailsPanelModule {
}
