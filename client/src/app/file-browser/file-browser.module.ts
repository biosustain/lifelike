import { NgModule } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';

import { NgbAccordionModule, NgbNavModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

import { AbstractObjectTypeProviderHelper } from 'app/file-types/providers/base-object.type-provider';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { SharedModule } from 'app/shared/shared.module';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { AppResizableColumnDirective } from 'app/shared/directives/app-resizable-column.directive';
import ObjectModule from 'app/shared/modules/object';

import { ObjectBrowserComponent } from './components/object-browser.component';
import { ObjectDeleteDialogComponent } from './components/dialog/object-delete-dialog.component';
import { BrowserProjectListComponent } from './components/browser/browser-project-list.component';
import { ProjectTitleAcronymPipe } from './services/project-title-acronym.pipe';
import { ProjectEditDialogComponent } from './components/dialog/project-edit-dialog.component';
import { ObjectDeletionResultDialogComponent } from './components/dialog/object-deletion-result-dialog.component';
import { CommunityBrowserComponent } from './components/community-browser.component';
import { BrowserComponent } from './components/browser/browser.component';
import { BrowserCommunityListComponent } from './components/browser/browser-community-list.component';
import { BrowserContextComponent } from './components/browser/browser-context.component';
import { ObjectInfoComponent } from './components/object-info.component';
import { ObjectTypeLabelComponent } from './components/object-type-label.component';
import { ObjectSelectionDialogComponent } from './components/dialog/object-selection-dialog.component';
import { FilesystemService } from './services/filesystem.service';
import { ObjectListComponent } from './components/object-list.component';
import { FilesystemObjectActions } from './services/filesystem-object-actions';
import { ProjectsService } from './services/projects.service';
import { ObjectEditDialogComponent } from './components/dialog/object-edit-dialog.component';
import { ObjectVersionHistoryComponent } from './components/object-version-history.component';
import { ObjectVersionHistoryDialogComponent } from './components/dialog/object-version-history-dialog.component';
import {
  ObjectPreviewComponent,
  ObjectPreviewOutletComponent,
} from './components/object-preview.component';
import { ObjectExportDialogComponent } from './components/dialog/object-export-dialog.component';
import { ObjectTileDeckComponent } from './components/object-tile-deck.component';
import { DirectoryPreviewComponent } from './components/directory-preview.component';
import { ProjectActions } from './services/project-actions';
import { ProjectCollaboratorsDialogComponent } from './components/dialog/project-collaborators-dialog.component';
import { FileAnnotationHistoryDialogComponent } from './components/dialog/file-annotation-history-dialog.component';
import { ObjectAnnotationHistoryComponent } from './components/object-annotation-history.component';
import { AnnotationsService } from './services/annotations.service';
import { ObjectCreationService } from './services/object-creation.service';
import { ObjectReannotateResultsDialogComponent } from './components/dialog/object-reannotate-results-dialog.component';
import { FilesystemObjectDataProvider } from './providers/filesystem-object-data.provider';
import { ObjectViewerComponent } from './components/object-viewer.component';
import { BrowserRecentListComponent } from './components/browser/browser-recent-list.component';
import { ObjectUploadDialogComponent } from './components/dialog/object-upload-dialog.component';
import { ObjectDeleteReqursiveDialogComponent } from './components/dialog/object-delete-reqursive-dialog.component';
import { BrowserPinnedListComponent } from './components/browser/browser-pinned-list.component';
import { StarredBrowserComponent } from './components/starred-browser.component';
import { PaginationComponent } from './components/pagination/pagination.component';
import { OrganismComponent } from './components/organism/organism.component';
import { UserSelectComponent } from './components/form/user-select/user-select.component';
import { SelectInputComponent } from './components/form/select-input/select-input.component';
import { AccountsService } from './services/accounts.service';
import { MouseNavigableDirective } from './directives/mouse-navigable.directive';
import { ObjectTableComponent } from './components/object-table/object-table.component';
import { AppCdkTableColgroupBackportComponent } from './components/object-table/cdk-table-colgroup-backport.component';

const exports = [
  ObjectInfoComponent,
  ObjectTypeLabelComponent,
  ObjectSelectionDialogComponent,
  ObjectListComponent,
  ObjectTileDeckComponent,
  ObjectEditDialogComponent,
  ObjectVersionHistoryDialogComponent,
  FileAnnotationHistoryDialogComponent,
  ObjectAnnotationHistoryComponent,
  ObjectReannotateResultsDialogComponent,
];

@NgModule({
  imports: [
    MatMenuModule,
    SharedModule,
    NgbAccordionModule,
    NgbPaginationModule,
    NgbNavModule,
    ObjectModule,
  ],
  declarations: [
    ObjectDeleteDialogComponent,
    ObjectDeletionResultDialogComponent,
    ObjectDeleteReqursiveDialogComponent,
    ObjectBrowserComponent,
    BrowserComponent,
    BrowserContextComponent,
    BrowserCommunityListComponent,
    BrowserRecentListComponent,
    StarredBrowserComponent,
    BrowserProjectListComponent,
    ProjectTitleAcronymPipe,
    ProjectEditDialogComponent,
    CommunityBrowserComponent,
    ObjectListComponent,
    ObjectVersionHistoryComponent,
    ObjectPreviewComponent,
    ObjectPreviewOutletComponent,
    ObjectExportDialogComponent,
    DirectoryPreviewComponent,
    ProjectCollaboratorsDialogComponent,
    ObjectViewerComponent,
    ObjectUploadDialogComponent,
    BrowserPinnedListComponent,
    ObjectTileDeckComponent,
    AppResizableColumnDirective,
    ObjectTableComponent,
    AppCdkTableColgroupBackportComponent,
    PaginationComponent,
    OrganismComponent,
    UserSelectComponent,
    SelectInputComponent,
    // Directives
    MouseNavigableDirective,

    ...exports,
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
    ProjectCollaboratorsDialogComponent,
    FileAnnotationHistoryDialogComponent,
    ObjectAnnotationHistoryComponent,
    ObjectReannotateResultsDialogComponent,
  ],
  providers: [
    AccountsService,
    ProjectsService,
    FilesystemService,
    AnnotationsService,
    FilesystemObjectActions,
    ProjectActions,
    ObjectCreationService,
    ObjectTypeService,
    AbstractObjectTypeProviderHelper,
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: FilesystemObjectDataProvider,
      multi: true,
    },
  ],
  exports,
})
export class FileBrowserModule {}
