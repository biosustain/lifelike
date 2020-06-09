import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import {
  DialogConfirmDeletionComponent,
  DialogEditFileComponent,
  DialogUploadComponent,
  FileBrowserComponent,
} from './file-browser.component';
import { FileSelectionDialogComponent } from './file-selection-dialog.component';
import { FileListComponent } from './file-list.component';

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
  ]
})
export class FileBrowserModule {
}
