import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { TraceViewComponent } from './components/trace-view.component';
import { TraceDetailsComponent } from './components/trace-details.component';
import { WarningPillComponent } from './components/warning-pill/warning-pill.component';

const exports = [TraceViewComponent];

@NgModule({
  imports: [
    BrowserAnimationsModule,
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
  ],
  declarations: [TraceDetailsComponent, WarningPillComponent, ...exports],
  exports,
})
export class TraceViewerLibModule {}
