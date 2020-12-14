import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { ObjectDeleteDialogComponent } from './components/object-delete-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';
import { BrowserProjectListComponent } from './components/browser/browser-project-list.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/project-edit-dialog.component';
import { ProjectCreateDialogComponent } from './components/project-create-dialog.component';
import { DirectoryEditDialogComponent } from './components/directory-edit-dialog.component';
import { ObjectDeletionResultDialogComponent } from './components/object-deletion-result-dialog.component';
import { CommunityBrowserComponent } from './components/community-browser.component';
import { BrowserComponent } from './components/browser/browser.component';
import { BrowserCommunityListComponent } from './components/browser/browser-community-list.component';
import { BrowserContextComponent } from './components/browser/browser-context.component';
import { FileInfoComponent } from './components/file-info.component';
import { DrawingToolModule } from '../drawing-tool/drawing-tool.module';
import { FileTypeLabelComponent } from './components/file-type-label.component';
import { EnrichmentTableViewerComponent } from './components/enrichment-table-viewer.component';
import { EnrichmentTableCreateDialogComponent } from './components/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from './components/enrichment-table-edit-dialog.component';
import { FilesystemService } from './services/filesystem.service';
import { FileListComponent } from './components/file-list.component';
import { FilesystemObjectActions } from './services/filesystem-object-actions';
import { EnrichmentTableOrderDialogComponent } from './components/enrichment-table-order-dialog.component';
import { FileAnnotationHistoryDialogComponent } from './components/dialog/file-annotation-history-dialog.component';
import { FileAnnotationHistoryComponent } from './components/file-annotation-history.component';
import { ObjectUploadDialogComponent } from './components/object-upload-dialog.component';
import { FileSelectionDialogComponent } from './components/dialog/file-selection-dialog.component';

@NgModule({
  declarations: [
    FileEditDialogComponent,
    ObjectDeleteDialogComponent,
    ObjectUploadDialogComponent,
    ObjectDeletionResultDialogComponent,
    FileBrowserComponent,
    FileViewComponent,
    BrowserComponent,
    BrowserContextComponent,
    BrowserCommunityListComponent,
    BrowserProjectListComponent,
    ProjectTitleAcronymPipe,
    ProjectEditDialogComponent,
    ProjectCreateDialogComponent,
    DirectoryEditDialogComponent,
    CommunityBrowserComponent,
    FileInfoComponent,
    FileTypeLabelComponent,
    EnrichmentTableViewerComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    FileSelectionDialogComponent,
    FileListComponent,
    FileAnnotationHistoryDialogComponent,
    FileAnnotationHistoryComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
    DrawingToolModule,
  ],
  entryComponents: [
    FileEditDialogComponent,
    ObjectDeleteDialogComponent,
    ObjectUploadDialogComponent,
    FileViewComponent,
    ProjectCreateDialogComponent,
    ProjectEditDialogComponent,
    DirectoryEditDialogComponent,
    ObjectDeletionResultDialogComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    FileSelectionDialogComponent,
    FileAnnotationHistoryDialogComponent,
    FileAnnotationHistoryComponent,
  ],
  exports: [
    FileInfoComponent,
    FileTypeLabelComponent,
    FileSelectionDialogComponent,
    FileListComponent,
    FileAnnotationHistoryDialogComponent,
    FileAnnotationHistoryComponent,
  ],
  providers: [
    FilesystemService,
    FilesystemObjectActions,
  ],
})
export class FileBrowserModule {
}
