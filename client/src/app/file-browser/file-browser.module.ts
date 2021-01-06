import {NgModule} from '@angular/core';
import {SharedModule} from 'app/shared/shared.module';
import {ObjectBrowserComponent} from './components/object-browser.component';
import {ObjectDeleteDialogComponent} from './components/dialog/object-delete-dialog.component';
import {BrowserProjectListComponent} from './components/browser/browser-project-list.component';
import {ProjectTitleAcronymPipe} from './services/project-title-acronym.pipe';
import {ProjectEditDialogComponent} from './components/dialog/project-edit-dialog.component';
import {ObjectDeletionResultDialogComponent} from './components/dialog/object-deletion-result-dialog.component';
import {CommunityBrowserComponent} from './components/community-browser.component';
import {BrowserComponent} from './components/browser/browser.component';
import {BrowserCommunityListComponent} from './components/browser/browser-community-list.component';
import {BrowserContextComponent} from './components/browser/browser-context.component';
import {ObjectInfoComponent} from './components/object-info.component';
import {ObjectTypeLabelComponent} from './components/object-type-label.component';
import {ObjectSelectionDialogComponent} from './components/dialog/object-selection-dialog.component';
import {FilesystemService} from './services/filesystem.service';
import {ObjectListComponent} from './components/object-list.component';
import {FilesystemObjectActions} from './services/filesystem-object-actions';
import {WordCloudModule} from './components/enrichment/visualisation/word-cloud/word-cloud.module';
import {CommonModule} from '@angular/common';
import {ChartsModule} from 'ng2-charts';
import {ChartModule} from './components/enrichment/visualisation/chart/chart.module';
import {ProjectsService} from './services/projects.service';
import {ObjectEditDialogComponent} from './components/dialog/object-edit-dialog.component';
import {ObjectVersionHistoryComponent} from './components/object-version-history.component';
import {ObjectVersionHistoryDialogComponent} from './components/dialog/object-version-history-dialog.component';
import {ObjectPreviewComponent, ObjectPreviewOutletComponent} from './components/object-preview.component';
import {ObjectExportDialogComponent} from './components/dialog/object-export-dialog.component';
import {ObjectTileDeckComponent} from './components/object-tile-deck.component';
import {ObjectPathComponent} from './components/object-path.component';
import {ObjectTypeService, TYPE_PROVIDER} from './services/object-type.service';
import {DirectoryTypeProvider} from './providers/directory-type-provider';
import {DirectoryPreviewComponent} from './components/directory-preview.component';
import {ObjectMenuComponent} from './components/object-menu.component';
import {ProjectActions} from './services/project-actions';
import {ProjectMenuComponent} from './components/project-menu.component';
import {EnrichmentTableViewerComponent} from './components/enrichment/table/enrichment-table-viewer.component';
import {EnrichmentTableCreateDialogComponent} from './components/enrichment/table/enrichment-table-create-dialog.component';
import {EnrichmentTableEditDialogComponent} from './components/enrichment/table/enrichment-table-edit-dialog.component';
import {EnrichmentTableOrderDialogComponent} from './components/enrichment/table/enrichment-table-order-dialog.component';
import {ProjectIconComponent} from './components/project-icon.component';
import {EnrichmentVisualisationViewerComponent} from './components/enrichment/visualisation/enrichment-visualisation-viewer.component';
import {EnrichmentVisualisationCreateDialogComponent} from './components/enrichment/visualisation/dialog/enrichment-visualisation-create-dialog.component';
import {EnrichmentVisualisationOrderDialogComponent} from './components/enrichment/visualisation/dialog/enrichment-visualisation-order-dialog.component';
import {EnrichmentVisualisationEditDialogComponent} from './components/enrichment/visualisation/dialog/enrichment-visualisation-edit-dialog.component';
import {AnnotationsService} from "./services/annotations.service";

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
    CommunityBrowserComponent,
    ObjectInfoComponent,
    ObjectTypeLabelComponent,
    EnrichmentTableViewerComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentVisualisationViewerComponent,
    EnrichmentVisualisationCreateDialogComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
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
    ProjectMenuComponent,
    ProjectIconComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    WordCloudModule,
    ChartsModule,
    ChartModule
  ],
  entryComponents: [
    ObjectDeleteDialogComponent,
    ProjectEditDialogComponent,
    ObjectDeletionResultDialogComponent,
    EnrichmentTableCreateDialogComponent,
    EnrichmentTableEditDialogComponent,
    EnrichmentTableOrderDialogComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
    ObjectSelectionDialogComponent,
    ObjectEditDialogComponent,
    ObjectVersionHistoryDialogComponent,
    ObjectPreviewComponent,
    ObjectExportDialogComponent,
    ObjectListComponent,
    ObjectTileDeckComponent,
    DirectoryPreviewComponent,
    ObjectMenuComponent,
    ProjectMenuComponent,
    ProjectIconComponent,
    EnrichmentVisualisationCreateDialogComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent
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
    ProjectIconComponent,
  ],
  providers: [
    ProjectsService,
    FilesystemService,
    FilesystemObjectActions,
    ProjectActions,
    ObjectTypeService,
    {
      provide: TYPE_PROVIDER,
      useClass: DirectoryTypeProvider,
      multi: true,
    },
    AnnotationsService
  ],
})
export class FileBrowserModule {
}
