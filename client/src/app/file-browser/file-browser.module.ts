import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { FileBrowserComponent } from './file-browser.component';
import { FileSelectionDialogComponent } from './file-selection-dialog.component';
import { FileListComponent } from './file-list.component';

@NgModule({
  declarations: [
    FileBrowserComponent,
    FileListComponent,
    FileSelectionDialogComponent,
  ],
  imports: [
    SharedModule,
  ],
  entryComponents: [
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
