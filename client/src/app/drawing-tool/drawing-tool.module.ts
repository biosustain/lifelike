import { NgModule } from '@angular/core';

// import { PdfViewerLibModule } from 'pdf-viewer-lib';
// import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';

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

import {
  PendingChangesGuard
} from './guards';
import { PaletteComponent } from './drawing-tool/palette/palette.component';
import { InfoPanelComponent } from './drawing-tool/info-panel/info-panel.component';
import { SplitterComponent } from './splitter/splitter.component';
import { MapPreviewComponent } from './project-list-view/map-preview/map-preview.component';
import { MapListComponent } from './project-list-view/map-list/map-list.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';

const routes = [
  {
    path: 'project-list',
    component: ProjectListViewComponent
  },
  {
    path: 'drawing-tool',
    component: DrawingToolComponent
  },
  {
    path: 'splitter',
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
    TruncatePipe,
    FriendlyDateStrPipe,
    PaletteComponent,
    InfoPanelComponent,
    SplitterComponent,
    MapPreviewComponent,
    MapListComponent
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    MapListComponent
  ],
  imports: [
    SharedModule,
    // PdfViewerLibModule,
    RouterModule.forChild(routes)
  ],
  providers: [
    // {
    //   provide: HTTP_INTERCEPTORS,
    //   useClass: AuthenticationService,
    //   multi: true
    // },
    PendingChangesGuard
  ],
  exports: [
    RouterModule
  ]
})
export class DrawingToolModule { }
