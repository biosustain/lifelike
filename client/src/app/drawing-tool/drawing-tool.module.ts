import { NgModule } from '@angular/core';

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
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { NodeFormComponent } from './components/map-editor/node-form.component';
import { EdgeFormComponent } from './components/map-editor/edge-form.component';
import { MapEditDialogComponent } from './components/map-edit-dialog.component';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { MapRestoreDialogComponent } from './components/map-restore-dialog.component';
import { MapComponent } from './components/map.component';
import { MapVersionDialogComponent } from './components/map-version-dialog.component';

@NgModule({
  declarations: [
    MapCreateDialogComponent,
    MapDeleteDialogComponent,
    MapCloneDialogComponent,
    MapUploadDialogComponent,
    MapVersionDialogComponent,
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapComponent,
    MapViewComponent,
    MapExportDialogComponent,
    NodeFormComponent,
    EdgeFormComponent,
    MapEditDialogComponent,
    MapRestoreDialogComponent,
  ],
  entryComponents: [
    MapCreateDialogComponent,
    MapDeleteDialogComponent,
    MapCloneDialogComponent,
    MapUploadDialogComponent,
    MapEditDialogComponent,
    MapVersionDialogComponent,
    MapExportDialogComponent,
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
  ],
  imports: [
    SharedModule,
  ],
  providers: [
    CopyPasteMapsService,
  ],
  exports: [
    RouterModule,
    MapComponent,
  ],
})
export class DrawingToolModule {
}
