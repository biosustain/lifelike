import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import {
  DialogConfirmDeletionComponent,
  DialogEditFileComponent,
  DialogUploadComponent,
  FileBrowserComponent,
} from './components/file-browser.component';
import { FileSelectionDialogComponent } from './components/file-selection-dialog.component';
import { FileListComponent } from './components/file-list.component';

@NgModule({
  declarations: [
    DialogConfirmDeletionComponent,
    DialogEditFileComponent,
    DialogUploadComponent,
    FileBrowserComponent,
    FileListComponent,
    FileSelectionDialogComponent,
  ],
  imports: [
    SharedModule,
  ],
  entryComponents: [
    DialogConfirmDeletionComponent,
    DialogEditFileComponent,
    DialogUploadComponent,
    FileSelectionDialogComponent,
    FileListComponent,
  ],
  exports: [
    FileSelectionDialogComponent,
    FileListComponent,
  ],
})
export class FileBrowserModule {
}
