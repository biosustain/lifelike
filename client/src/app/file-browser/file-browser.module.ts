import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { FileDeleteDialogComponent } from './components/file-delete-dialog.component';
import { FileUploadDialogComponent } from './components/file-upload-dialog.component';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
    FileBrowserComponent,
  ],
  imports: [
    SharedModule,
  ],
  entryComponents: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
  ],
  exports: [],
})
export class FileBrowserModule {
}
