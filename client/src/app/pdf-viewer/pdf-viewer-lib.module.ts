import { NgModule } from '@angular/core';
import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { AnnotationPanelComponent } from './annotation-panel/annotation-panel.component';

import { PdfViewerModule } from './pdf-viewer/pdf-viewer.module';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule, MatDialogModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  declarations: [PdfViewerLibComponent, AnnotationPanelComponent],
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
    MatButtonModule
  ],
  entryComponents: [AnnotationPanelComponent],
  exports: [PdfViewerLibComponent]
})
export class PdfViewerLibModule {
}
