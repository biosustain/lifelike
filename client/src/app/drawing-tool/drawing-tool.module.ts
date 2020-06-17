import { NgModule } from '@angular/core';

import { ProjectListViewComponent } from './project-list-view/project-list-view.component';
import { CreateProjectDialogComponent } from './project-list-view/create-project-dialog/create-project-dialog.component';
import { DeleteProjectDialogComponent } from './project-list-view/delete-project-dialog/delete-project-dialog.component';
import { CopyProjectDialogComponent } from './project-list-view/copy-project-dialog/copy-project-dialog.component';
import { UploadProjectDialogComponent } from './project-list-view/upload-project-dialog/upload-project-dialog.component';
import { DrawingToolComponent } from './drawing-tool/drawing-tool.component';

import { CopyPasteMapsService } from './services/copy-paste-maps.service';

import { DrawingToolContextMenuComponent } from './drawing-tool/drawing-tool-context-menu/drawing-tool-context-menu.component';
import { PaletteComponent } from './drawing-tool/palette/palette.component';
import { InfoPanelComponent } from './drawing-tool/info-panel/info-panel.component';
import { ExportModalComponent } from './drawing-tool/export-modal/export-modal.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MapPreviewComponent } from './project-list-view/map-preview/map-preview.component';
import { MapListComponent } from './project-list-view/map-list/map-list.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { PdfViewerLibModule } from 'app/pdf-viewer/pdf-viewer-lib.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { EdgeFormComponent } from './drawing-tool/info-panel/edge-form.component';
import { NodeFormComponent } from './drawing-tool/info-panel/node-form.component';
import { NodeSearchComponent } from '../node-search/containers/node-search.component';
import { EditProjectDialogComponent } from './project-list/edit-project-dialog/edit-project-dialog.component';
import { ConfirmDialogComponent } from 'app/shared/components/confirm-dialog/confirm-dialog.component';
import { UnloadConfirmationGuard } from '../shared/guards/UnloadConfirmation.guard';

export const routes = [
  {
    path: 'project-list',
    component: ProjectListViewComponent
  },
  {
    path: 'map/edit/:hash_id',
    component: DrawingToolComponent,
    canDeactivate: [UnloadConfirmationGuard]
  },
  {
    path: 'map/:hash_id',
    component: ProjectListViewComponent
  }
];

@NgModule({
  declarations: [
    ProjectListViewComponent,
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    UploadProjectDialogComponent,
    DrawingToolComponent,
    DrawingToolContextMenuComponent,
    PdfViewerComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapPreviewComponent,
    MapListComponent,
    ExportModalComponent,
    NodeFormComponent,
    EdgeFormComponent,
    EditProjectDialogComponent,
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    UploadProjectDialogComponent,
    EditProjectDialogComponent,
    MapListComponent,
    ProjectListViewComponent,
    PdfViewerComponent,
    ExportModalComponent,
    NodeSearchComponent,
    ConfirmDialogComponent
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
    MatDialogModule,
    RouterModule.forChild(routes),
    FileBrowserModule,
  ],
  providers: [
    CopyPasteMapsService,
    // {
    //   provide: HTTP_INTERCEPTORS,
    //   useClass: AuthenticationService,
    //   multi: true
    // },
  ],
  exports: [
    RouterModule,
    PdfViewerLibModule
  ]
})
export class DrawingToolModule {
}
