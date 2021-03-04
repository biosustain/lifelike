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
import {CommonModule} from '@angular/common';
import {ChartsModule} from 'ng2-charts';
import {ProjectsService} from './services/projects.service';
import {ObjectEditDialogComponent} from './components/dialog/object-edit-dialog.component';
import {ObjectVersionHistoryComponent} from './components/object-version-history.component';
import {ObjectVersionHistoryDialogComponent} from './components/dialog/object-version-history-dialog.component';
import {
  ObjectPreviewComponent,
  ObjectPreviewOutletComponent,
} from './components/object-preview.component';
import {ObjectExportDialogComponent} from './components/dialog/object-export-dialog.component';
import {ObjectTileDeckComponent} from './components/object-tile-deck.component';
import {ObjectPathComponent} from './components/object-path.component';
import {ObjectTypeService, TYPE_PROVIDER} from './services/object-type.service';
import { DirectoryTypeProvider } from './providers/directory.type-provider';
import {DirectoryPreviewComponent} from './components/directory-preview.component';
import {ObjectMenuComponent} from './components/object-menu.component';
import {ProjectActions} from './services/project-actions';
import {ProjectMenuComponent} from './components/project-menu.component';
import {ProjectIconComponent} from './components/project-icon.component';
import { ProjectCollaboratorsDialogComponent } from './components/dialog/project-collaborators-dialog.component';
import { FileAnnotationHistoryDialogComponent } from './components/dialog/file-annotation-history-dialog.component';
import { ObjectAnnotationHistoryComponent } from './components/object-annotation-history.component';
import { ObjectCreationService } from './services/object-creation.service';
import { ObjectAnnotateDialogComponent } from './components/dialog/object-annotate-dialog.component';
import { FilesystemObjectTargetDirective } from './directives/filesystem-object-target.directive';
import {AnnotationsService} from './services/annotations.service';
import {WordCloudModule} from '../shared/components/word-cloud/word-cloud.module';
import {ChartModule} from '../enrichment/components/visualisation/group/chart/chart.module';

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
    ProjectCollaboratorsDialogComponent,
    FileAnnotationHistoryDialogComponent,
    ObjectAnnotationHistoryComponent,
    ObjectAnnotateDialogComponent,
    FilesystemObjectTargetDirective,
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
    ProjectCollaboratorsDialogComponent,
    FileAnnotationHistoryDialogComponent,
    ObjectAnnotationHistoryComponent,
    ObjectAnnotateDialogComponent,
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
    FileAnnotationHistoryDialogComponent,
    ObjectAnnotationHistoryComponent,
    ObjectAnnotateDialogComponent,
    FilesystemObjectTargetDirective,
  ],
  providers: [
    ProjectsService,
    FilesystemService,
    AnnotationsService,
    FilesystemObjectActions,
    ProjectActions,
    ObjectCreationService,
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
