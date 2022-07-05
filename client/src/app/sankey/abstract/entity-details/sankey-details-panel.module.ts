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

import { SankeyNodeDetailsComponent } from '../../components/entity-details/node-details.component';
import { SankeyTraceDetailsComponent } from '../../components/entity-details/trace-details.component';
import { ButtonWithSelectableTextComponent } from '../../components/button-with-selectable-text/button-with-selectable-text.component';

@NgModule({
  declarations: [
    SankeyNodeDetailsComponent,
    SankeyTraceDetailsComponent,
    ButtonWithSelectableTextComponent
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
  ],
  exports: [
    SankeyNodeDetailsComponent,
    SankeyTraceDetailsComponent,
    ButtonWithSelectableTextComponent
  ],
})
export class SankeyDetailsPanelModule {
}
