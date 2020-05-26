import { NgModule } from '@angular/core';

import {
  ProjectListViewComponent
} from './project-list-view/project-list-view.component';
import {
  CreateProjectDialogComponent
} from './project-list-view/create-project-dialog/create-project-dialog.component';
import {
  DeleteProjectDialogComponent
} from './project-list-view/delete-project-dialog/delete-project-dialog.component';
import {
  CopyProjectDialogComponent
} from './project-list-view/copy-project-dialog/copy-project-dialog.component';
import {
  DrawingToolComponent
} from './drawing-tool/drawing-tool.component';
import {
  TruncatePipe,
  FriendlyDateStrPipe
} from './pipes';

import { CopyPasteMapsService } from './services/copy-paste-maps.service';

import {
  PendingChangesGuard
} from './guards';

import { DrawingToolContextMenuComponent } from './drawing-tool/drawing-tool-context-menu/drawing-tool-context-menu.component';
import { PaletteComponent } from './drawing-tool/palette/palette.component';
import { InfoPanelComponent } from './drawing-tool/info-panel/info-panel.component';
import { SplitterComponent } from './splitter/splitter.component';
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

export const routes = [
  {
    path: 'project-list',
    component: ProjectListViewComponent
  },
  {
    path: 'drawing-tool',
    component: DrawingToolComponent
  },
  {
    path: 'splitter/:hash_id',
    component: SplitterComponent,
    canDeactivate: [PendingChangesGuard]
  },
  {
    path: 'map/:hash_id',
    component: MapPreviewComponent
  }
];

@NgModule({
  declarations: [
    ProjectListViewComponent,
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    DrawingToolComponent,
    DrawingToolContextMenuComponent,
    PdfViewerComponent,
    TruncatePipe,
    FriendlyDateStrPipe,
    PaletteComponent,
    InfoPanelComponent,
    SplitterComponent,
    MapPreviewComponent,
    MapListComponent,
    ExportModalComponent,
    NodeFormComponent,
    EdgeFormComponent,
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    MapListComponent,
    ProjectListViewComponent,
    PdfViewerComponent,
    ExportModalComponent
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
    PendingChangesGuard
  ],
  exports: [
    RouterModule,
    PdfViewerLibModule
  ]
})
export class DrawingToolModule { }
