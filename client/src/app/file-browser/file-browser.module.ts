import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserComponent } from './components/file-browser.component';
import { FileEditDialogComponent } from './components/file-edit-dialog.component';
import { ObjectDeleteDialogComponent } from './components/object-delete-dialog.component';
import { ObjectUploadDialogComponent } from './components/object-upload-dialog.component';
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
import { EnrichmentTableViewerComponent } from './components/enrichment/table/enrichment-table-viewer.component';
import { EnrichmentTableCreateDialogComponent } from './components/enrichment/table/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from './components/enrichment/table/enrichment-table-edit-dialog.component';
import { FileSelectionDialogComponent } from './components/dialog/file-selection-dialog.component';
import { FilesystemService } from './services/filesystem.service';
import { FileListComponent } from './components/file-list.component';
import { FilesystemObjectActions } from './services/filesystem-object-actions';
import { EnrichmentTableOrderDialogComponent } from './components/enrichment/table/enrichment-table-order-dialog.component';
import {EnrichmentVisualisationViewerComponent} from "./components/enrichment/visualisation/enrichment-visualisation-viewer.component";
import {EnrichmentVisualisationCreateDialogComponent} from "./components/enrichment/visualisation/dialog/enrichment-visualisation-create-dialog.component";
import {EnrichmentVisualisationEditDialogComponent} from "./components/enrichment/visualisation/dialog/enrichment-visualisation-edit-dialog.component";
import {EnrichmentVisualisationOrderDialogComponent} from "./components/enrichment/visualisation/dialog/enrichment-visualisation-order-dialog.component";
import {WordCloudModule} from "./components/enrichment/visualisation/word-cloud/word-cloud.module";

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
    EnrichmentVisualisationViewerComponent,
    EnrichmentVisualisationCreateDialogComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
    FileSelectionDialogComponent,
    FileListComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
    DrawingToolModule,
    WordCloudModule,
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
    EnrichmentVisualisationCreateDialogComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
    FileSelectionDialogComponent,
  ],
  exports: [
    FileInfoComponent,
    FileTypeLabelComponent,
    FileSelectionDialogComponent,
    FileListComponent,
  ],
  providers: [
    FilesystemService,
    FilesystemObjectActions,
  ],
})
export class FileBrowserModule {
}
