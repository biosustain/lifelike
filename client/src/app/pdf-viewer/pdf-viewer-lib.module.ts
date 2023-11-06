import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import {
  NgbCollapseModule,
  NgbDropdownModule,
  NgbModalModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { PdfViewerModule } from './pdf-viewer/pdf-viewer.module';
import { PdfViewComponent } from './components/pdf-view.component';
import { AnnotationToolbarComponent } from './components/annotation-toolbar.component';
import { AnnotationLayerComponent } from './components/annotation-layer/annotation-layer.component';
import { AnnotationTooltipComponent } from './components/annotation-tooltip/annotation-tooltip.component';

const exports = [PdfViewComponent];

@NgModule({
  declarations: [
    PdfViewerLibComponent,
    AnnotationEditDialogComponent,
    AnnotationExcludeDialogComponent,
    AnnotationToolbarComponent,
    AnnotationLayerComponent,
    AnnotationTooltipComponent,
    ...exports,
  ],
  imports: [
    PdfViewerModule,
    BrowserAnimationsModule,
    MatSnackBarModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
    NgbTooltipModule,
    NgbModalModule,
    NgbCollapseModule,
    NgbDropdownModule,
  ],
  entryComponents: [
    PdfViewComponent,
    AnnotationEditDialogComponent,
    AnnotationExcludeDialogComponent,
  ],
  exports,
})
export class PdfViewerLibModule {}
