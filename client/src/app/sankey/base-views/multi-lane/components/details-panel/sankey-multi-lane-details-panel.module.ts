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

import { SharedModule } from 'app/shared/shared.module';
import { SankeyDetailsPanelModule } from 'app/sankey/components/details-panel/sankey-details-panel.module';

import { SankeyMutiLaneDetailsPanelComponent } from './details-panel.component';
import { SankeyMultiLaneLinkDetailsComponent } from './link-details.component';

@NgModule({
  declarations: [
    SankeyMutiLaneDetailsPanelComponent,
    SankeyMultiLaneLinkDetailsComponent
  ],
  imports: [
    CommonModule,
    SankeyDetailsPanelModule
  ],
  exports: [
    SankeyMutiLaneDetailsPanelComponent
  ],
})
export class SankeyMultiLaneDetailsPanelModule {
}
