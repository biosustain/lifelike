import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { FileDeleteDialogComponent } from './components/file-delete-dialog.component';
import { FileUploadDialogComponent } from './components/file-upload-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';
import { ProjectSpaceComponent } from './components/project-space/project-space.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { EditProjectDialogComponent } from './components/edit-project-dialog/edit-project-dialog.component';
import { CreateProjectDialogComponent } from './components/create-project-dialog/create-project-dialog.component';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    FileDeleteDialogComponent,
    FileUploadDialogComponent,
    FileBrowserComponent,
    FileViewComponent,
    ProjectSpaceComponent,
    ProjectTitleAcronymPipe,
    EditProjectDialogComponent,
    CreateProjectDialogComponent
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
    CreateProjectDialogComponent,
    EditProjectDialogComponent
  ],
  exports: [],
})
export class FileBrowserModule {
}
