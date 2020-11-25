import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { ObjectDeleteDialogComponent } from './components/dialog/object-delete-dialog.component';
import { FileViewComponent } from './components/file-view.component';
import { PdfViewerLibModule } from '../pdf-viewer/pdf-viewer-lib.module';
import { BrowserProjectListComponent } from './components/browser/browser-project-list.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/dialog/project-edit-dialog.component';
import { ProjectCreateDialogComponent } from './components/dialog/project-create-dialog.component';
import { ObjectDeletionResultDialogComponent } from './components/dialog/object-deletion-result-dialog.component';
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
import { ObjectSelectionDialogComponent } from './components/dialog/object-selection-dialog.component';
import { FilesystemService } from './services/filesystem.service';
import { FileListComponent } from './components/file-list.component';
import { FilesystemObjectActions } from './services/filesystem-object-actions';
import { ProjectService } from './services/project.service';
import { ObjectEditDialogComponent } from './components/dialog/object-edit-dialog.component';
import { ObjectVersionHistoryComponent } from './components/object-version-history.component';
import { ObjectVersionHistoryDialogComponent } from './components/dialog/object-version-history-dialog.component';
import { ObjectPreviewComponent } from './components/object-preview.component';

@NgModule({
  declarations: [
    ObjectDeleteDialogComponent,
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
    CommunityBrowserComponent,
    FileInfoComponent,
    FileTypeLabelComponent,
    EnrichmentTableViewerComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    ObjectSelectionDialogComponent,
    FileListComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPreviewComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
    DrawingToolModule,
  ],
  entryComponents: [
    ObjectDeleteDialogComponent,
    FileViewComponent,
    ProjectCreateDialogComponent,
    ProjectEditDialogComponent,
    ObjectDeletionResultDialogComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    ObjectSelectionDialogComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPreviewComponent,
  ],
  exports: [
    FileInfoComponent,
    FileTypeLabelComponent,
    ObjectSelectionDialogComponent,
    FileListComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryDialogComponent,
  ],
  providers: [
    ProjectService,
    FilesystemService,
    FilesystemObjectActions,
  ],
})
export class FileBrowserModule {
}
