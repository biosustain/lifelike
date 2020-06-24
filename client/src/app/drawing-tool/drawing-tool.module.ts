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
import { MapPreviewComponent } from './components/map-preview.component';
import { MapListComponent } from './components/map-list.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { PdfViewerComponent } from './components/pdf-viewer.component';
import { PdfViewerLibModule } from 'app/pdf-viewer/pdf-viewer-lib.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { EdgeFormComponent } from './components/map-editor/edge-form.component';
import { NodeFormComponent } from './components/map-editor/node-form.component';
import { NodeSearchComponent } from '../node-search/containers/node-search.component';
import { MapEditDialogComponent } from './components/map-edit-dialog.component';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { UnloadConfirmationGuard } from '../shared/guards/UnloadConfirmation.guard';

export const routes = [{
  path: 'map',
  component: MapBrowserComponent,
}, {
  path: 'map/edit/:hash_id',
  component: MapEditorComponent,
  canDeactivate: [UnloadConfirmationGuard],
}, {
  path: 'map/:hash_id',
  component: MapBrowserComponent,
}];

@NgModule({
  declarations: [
    MapBrowserComponent,
    MapCreateDialogComponent,
    MapDeleteDialogComponent,
    MapCloneDialogComponent,
    MapUploadDialogComponent,
    MapEditorComponent,
    PdfViewerComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapPreviewComponent,
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
    PdfViewerComponent,
    MapExportDialogComponent,
    NodeSearchComponent,
    ConfirmDialogComponent,
  ],
  imports: [
    SharedModule,
    PdfViewerLibModule,
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
    PdfViewerLibModule,
  ],
})
export class DrawingToolModule {
}
