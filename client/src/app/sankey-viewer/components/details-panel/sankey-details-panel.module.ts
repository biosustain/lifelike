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
import { SankeyNodeDetailsComponent } from './node-details.component';
import { SankeyLinkDetailsComponent } from './link-details.component';
import { SankeyTraceDetailsComponent } from './trace-details.component';
import { SankeyDetailsPanelComponent } from './details-panel.component';
import { SankeyDetailsComponent } from './details.component';
import { ButtonWithSelectableTextComponent } from './button-with-selectable-text.component';

@NgModule({
  declarations: [
    SankeyDetailsPanelComponent,
    SankeyNodeDetailsComponent,
    SankeyLinkDetailsComponent,
    SankeyTraceDetailsComponent,
    SankeyDetailsComponent,
    ButtonWithSelectableTextComponent
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
  ],
  exports: [
    SankeyDetailsPanelComponent
  ],
})
export class SankeyDetailsPanelModule {
}
