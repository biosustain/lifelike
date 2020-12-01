import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { ObjectBrowserComponent } from './components/object-browser.component';
import { ObjectDeleteDialogComponent } from './components/dialog/object-delete-dialog.component';
import { BrowserProjectListComponent } from './components/browser/browser-project-list.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/dialog/project-edit-dialog.component';
import { ProjectCreateDialogComponent } from './components/dialog/project-create-dialog.component';
import { ObjectDeletionResultDialogComponent } from './components/dialog/object-deletion-result-dialog.component';
import { CommunityBrowserComponent } from './components/community-browser.component';
import { BrowserComponent } from './components/browser/browser.component';
import { BrowserCommunityListComponent } from './components/browser/browser-community-list.component';
import { BrowserContextComponent } from './components/browser/browser-context.component';
import { ObjectInfoComponent } from './components/object-info.component';
import { ObjectTypeLabelComponent } from './components/object-type-label.component';
import { EnrichmentTableViewerComponent } from './components/enrichment-table-viewer.component';
import { EnrichmentTableCreateDialogComponent } from './components/enrichment-table-create-dialog.component';
import { EnrichmentTableEditDialogComponent } from './components/enrichment-table-edit-dialog.component';
import { ObjectSelectionDialogComponent } from './components/dialog/object-selection-dialog.component';
import { FilesystemService } from './services/filesystem.service';
import { ObjectListComponent } from './components/object-list.component';
import { FilesystemObjectActions } from './services/filesystem-object-actions';
import { ProjectService } from './services/project.service';
import { ObjectEditDialogComponent } from './components/dialog/object-edit-dialog.component';
import { ObjectVersionHistoryComponent } from './components/object-version-history.component';
import { ObjectVersionHistoryDialogComponent } from './components/dialog/object-version-history-dialog.component';
import { ObjectPreviewComponent, ObjectPreviewOutletComponent } from './components/object-preview.component';
import { EnrichmentTableOrderDialogComponent } from './components/enrichment-table-order-dialog.component';
import { ObjectExportDialogComponent } from './components/dialog/object-export-dialog.component';
import { ObjectTileDeckComponent } from './components/object-tile-deck.component';
import { ObjectPathComponent } from './components/object-path.component';
import { ObjectTypeService, TYPE_PROVIDER } from './services/object-type.service';
import { DirectoryTypeProvider } from './providers/directory-type-provider';
import { DirectoryPreviewComponent } from './components/directory-preview.component';
import { ObjectMenuComponent } from './components/object-menu.component';

@NgModule({
  declarations: [
    ObjectDeleteDialogComponent,
    ObjectDeletionResultDialogComponent,
    ObjectBrowserComponent,
    BrowserComponent,
    BrowserContextComponent,
    BrowserCommunityListComponent,
    BrowserProjectListComponent,
    ProjectTitleAcronymPipe,
    ProjectEditDialogComponent,
    ProjectCreateDialogComponent,
    CommunityBrowserComponent,
    ObjectInfoComponent,
    ObjectTypeLabelComponent,
    EnrichmentTableViewerComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    ObjectSelectionDialogComponent,
    ObjectListComponent,
    ObjectTileDeckComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPreviewComponent,
    ObjectPreviewOutletComponent,
    ObjectExportDialogComponent,
    ObjectPathComponent,
    DirectoryPreviewComponent,
    ObjectMenuComponent,
  ],
  imports: [
    SharedModule,
  ],
  entryComponents: [
    ObjectDeleteDialogComponent,
    ProjectCreateDialogComponent,
    ProjectEditDialogComponent,
    ObjectDeletionResultDialogComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    ObjectSelectionDialogComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPreviewComponent,
    ObjectExportDialogComponent,
    ObjectListComponent,
    ObjectTileDeckComponent,
    DirectoryPreviewComponent,
    ObjectMenuComponent,
  ],
  exports: [
    ObjectInfoComponent,
    ObjectTypeLabelComponent,
    ObjectSelectionDialogComponent,
    ObjectListComponent,
    ObjectTileDeckComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPathComponent,
    ObjectMenuComponent,
  ],
  providers: [
    ProjectService,
    FilesystemService,
    FilesystemObjectActions,
    ObjectTypeService,
    {
      provide: TYPE_PROVIDER,
      useClass: DirectoryTypeProvider,
      multi: true,
    },
  ],
})
export class FileBrowserModule {
}
