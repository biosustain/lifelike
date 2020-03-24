import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';

import { PdfViewerLibModule } from 'pdf-viewer-lib';
import { MaterialModule } from './material.module';

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
  LoginComponent
} from './login/login.component';

import { 
  TruncatePipe,
  FriendlyDateStrPipe
} from './pipes';

@NgModule({
  declarations: [
    ProjectListViewComponent,
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent,
    DrawingToolComponent,
    SideBarUiComponent,
    PdfViewerComponent,
    LoginComponent,
    TruncatePipe,
    FriendlyDateStrPipe
  ],
  entryComponents: [
    CreateProjectDialogComponent,
    DeleteProjectDialogComponent,
    CopyProjectDialogComponent
  ],
  imports: [
    CommonModule,
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    RouterModule.forRoot([]),
    PdfViewerLibModule,
    MaterialModule
  ]
})
export class MockupModule { }
