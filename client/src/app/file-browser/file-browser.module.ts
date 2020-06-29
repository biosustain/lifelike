import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { FileDeleteDialogComponent } from './components/file-delete-dialog.component';
import { FileUploadDialogComponent } from './components/file-upload-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
    FileBrowserComponent,
    FileViewComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
  ],
  entryComponents: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
    FileViewComponent,
  ],
  exports: [],
})
export class FileBrowserModule {
}
