import { NgModule } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { RouterModule } from '@angular/router';
import { TraceViewComponent } from './components/trace-view.component';
import { TraceDetailsComponent } from './components/trace-details.component';

@NgModule({
  declarations: [
    TraceViewComponent,
    TraceDetailsComponent
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
    RouterModule.forRoot([])
  ],
  entryComponents: []
})
export class TraceViewerLibModule {
}
