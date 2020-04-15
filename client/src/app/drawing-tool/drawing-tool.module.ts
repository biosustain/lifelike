import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';


import { PdfViewerLibModule } from 'pdf-viewer-lib';

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
  PdfViewerComponent
} from './pdf-viewer/pdf-viewer.component';

import {
  TruncatePipe,
  FriendlyDateStrPipe
} from './pipes';

import {
  PendingChangesGuard
} from './guards';
import { PaletteComponent } from './drawing-tool/palette/palette.component';
import { InfoPanelComponent } from './drawing-tool/info-panel/info-panel.component';
import { PdfViewerDirective } from './pdf-viewer/pdf-viewer.directive';
import { SplitterComponent } from './splitter/splitter.component';
import { MapPreviewComponent } from './project-list-view/map-preview/map-preview.component';
import { MapListComponent } from './project-list-view/map-list/map-list.component';
import { SharedModule } from 'app/shared/shared.module';

@NgModule({
  declarations: [
    ProjectListViewComponent,
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    DrawingToolComponent,
    PdfViewerComponent,
    TruncatePipe,
    FriendlyDateStrPipe,
    PaletteComponent,
    InfoPanelComponent,
    PdfViewerDirective,
    SplitterComponent,
    MapPreviewComponent,
    MapListComponent
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    PdfViewerComponent,
    MapListComponent
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule
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
  ]
})
export class DrawingToolModule { }
