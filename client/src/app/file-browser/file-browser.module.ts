import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { FileDeleteDialogComponent } from './components/file-delete-dialog.component';
import { FileUploadDialogComponent } from './components/file-upload-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';
import { ProjectBrowserComponent } from './components/project-browser.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/project-edit-dialog.component';
import { ProjectCreateDialogComponent } from './components/project-create-dialog.component';
import { ContentAddDialogComponent } from './components/content-add-dialog.component';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
    FileBrowserComponent,
    FileViewComponent,
    ProjectBrowserComponent,
    ProjectTitleAcronymPipe,
    ProjectEditDialogComponent,
    ProjectCreateDialogComponent,
    ContentAddDialogComponent,
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
    ProjectCreateDialogComponent,
    ProjectEditDialogComponent,
    ContentAddDialogComponent,
  ],
  exports: [],
})
export class FileBrowserModule {
}
