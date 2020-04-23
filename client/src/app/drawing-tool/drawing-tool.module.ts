import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FlexLayoutModule } from '@angular/flex-layout';
import {TextFieldModule} from '@angular/cdk/text-field';

import { AngularSplitModule } from 'angular-split';

import { PdfViewerLibModule } from 'pdf-viewer-lib';
import { AngularMaterialModule } from 'app/shared/angular-material.module';

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

import { CopyPasteMapsService } from './services/copy-paste-maps.service';

import {
  PendingChangesGuard
} from './guards';

import { DrawingToolContextMenuComponent } from './drawing-tool/drawing-tool-context-menu/drawing-tool-context-menu.component';
import { PaletteComponent } from './drawing-tool/palette/palette.component';
import { InfoPanelComponent } from './drawing-tool/info-panel/info-panel.component';
import { PdfViewerDirective } from './pdf-viewer/pdf-viewer.directive';
import { SplitterComponent } from './splitter/splitter.component';
import { MapSearchChannelComponent } from './map-search-channel/map-search-channel.component';

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
    PdfViewerDirective,
    SplitterComponent,
    MapSearchChannelComponent
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    PdfViewerComponent,
    MapSearchChannelComponent
  ],
  imports: [
    AngularSplitModule.forRoot(),
    CommonModule,
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    PdfViewerLibModule,
    AngularMaterialModule,
    FlexLayoutModule,
    TextFieldModule
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
  ]
})
export class DrawingToolModule { }
