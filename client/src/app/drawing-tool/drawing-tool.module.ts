import { NgModule } from '@angular/core';

import { MapBrowserComponent } from './components/map-browser.component';
import { MapCreateDialogComponent } from './components/map-create-dialog.component';
import { MapDeleteDialogComponent } from './components/map-delete-dialog.component';
import { MapCloneDialogComponent } from './components/map-clone-dialog.component';
import { MapUploadDialogComponent } from './components/map-upload-dialog.component';
import { MapEditorComponent } from './components/map-editor/map-editor.component';

import { CopyPasteMapsService } from './services/copy-paste-maps.service';

import { PaletteComponent } from './components/map-editor/palette.component';
import { InfoPanelComponent } from './components/map-editor/info-panel.component';
import { MapExportDialogComponent } from './components/map-export-dialog.component';
import { MapViewComponent } from './components/map-view.component';
import { MapListComponent } from './components/map-list.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { EdgeFormComponent } from './components/map-editor/edge-form.component';
import { NodeFormComponent } from './components/map-editor/node-form.component';
import { NodeSearchComponent } from '../node-search/containers/node-search.component';
import { MapEditDialogComponent } from './components/map-edit-dialog.component';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';

@NgModule({
  declarations: [
    MapBrowserComponent,
    MapCreateDialogComponent,
    MapDeleteDialogComponent,
    MapCloneDialogComponent,
    MapUploadDialogComponent,
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapViewComponent,
    MapListComponent,
    MapExportDialogComponent,
    NodeFormComponent,
    EdgeFormComponent,
    MapEditDialogComponent,
  ],
  entryComponents: [
    MapCreateDialogComponent,
    MapDeleteDialogComponent,
    MapCloneDialogComponent,
    MapUploadDialogComponent,
    MapEditDialogComponent,
    MapListComponent,
    MapBrowserComponent,
    MapExportDialogComponent,
    NodeSearchComponent,
    ConfirmDialogComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  providers: [
    CopyPasteMapsService,
  ],
  exports: [
    RouterModule,
  ],
})
export class DrawingToolModule {
}
