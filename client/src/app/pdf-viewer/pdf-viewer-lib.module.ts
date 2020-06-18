import { NgModule } from '@angular/core';
import { PdfViewerLibComponent } from './pdf-viewer-lib.component';
import { AnnotationPanelComponent } from './annotation-panel/annotation-panel.component';

import { PdfViewerModule } from './pdf-viewer/pdf-viewer.module';

import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SharedModule } from 'app/shared/shared.module';

@NgModule({
  declarations: [PdfViewerLibComponent, AnnotationPanelComponent],
  imports: [
    PdfViewerModule,
    CommonModule,
    BrowserAnimationsModule,
    SharedModule
  ],
  entryComponents: [AnnotationPanelComponent],
  exports: [PdfViewerLibComponent]
})
export class PdfViewerLibModule {
}
