import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { ObjectDeleteDialogComponent } from './components/object-delete-dialog.component';
import { ObjectUploadDialogComponent } from './components/object-upload-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';
import { ProjectBrowserComponent } from './components/project-browser.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/project-edit-dialog.component';
import { ProjectCreateDialogComponent } from './components/project-create-dialog.component';
import { DirectoryCreateDialogComponent } from './components/directory-create-dialog.component';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    ObjectDeleteDialogComponent,
    ObjectUploadDialogComponent,
    FileBrowserComponent,
    FileViewComponent,
    ProjectBrowserComponent,
    ProjectTitleAcronymPipe,
    ProjectEditDialogComponent,
    ProjectCreateDialogComponent,
    DirectoryCreateDialogComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
  ],
  entryComponents: [
    FileEditDialogComponent,
    ObjectDeleteDialogComponent,
    ObjectUploadDialogComponent,
    FileViewComponent,
    ProjectCreateDialogComponent,
    ProjectEditDialogComponent,
    DirectoryCreateDialogComponent,
  ],
  exports: [],
})
export class FileBrowserModule {
}
