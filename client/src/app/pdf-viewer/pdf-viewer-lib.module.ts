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

import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { PdfViewerModule } from './pdf-viewer/pdf-viewer.module';
import { PdfViewComponent } from './components/pdf-view.component';
import { AnnotationToolbarComponent } from './components/annotation-toolbar.component';

@NgModule({
  declarations: [
    PdfViewerLibComponent,
    AnnotationEditDialogComponent,
    AnnotationExcludeDialogComponent,
    PdfViewComponent,
    AnnotationToolbarComponent,
  ],
  imports: [
    PdfViewerModule,
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
  ],
  entryComponents: [
    PdfViewComponent,
    AnnotationEditDialogComponent,
    AnnotationExcludeDialogComponent,
  ],
  exports: [
    PdfViewerLibComponent,
    PdfViewComponent,
  ],
})
export class PdfViewerLibModule {
}
