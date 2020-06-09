import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { DialogConfirmDeletionComponent, DialogUploadComponent, FileBrowserComponent, } from './components/file-browser.component';
import { FileSelectionDialogComponent } from './components/file-selection-dialog.component';
import { FileListComponent } from './components/file-list.component';

@NgModule({
  declarations: [
    DialogConfirmDeletionComponent,
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
