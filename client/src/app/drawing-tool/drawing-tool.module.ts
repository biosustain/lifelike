import { NgModule } from '@angular/core';
import { MapEditorComponent } from './components/map-editor/map-editor.component';

import { PaletteComponent } from './components/map-editor/palette.component';
import { InfoPanelComponent } from './components/map-editor/info-panel.component';
import { MapViewComponent } from './components/map-view.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { NodeFormComponent } from './components/map-editor/node-form.component';
import { EdgeFormComponent } from './components/map-editor/edge-form.component';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { MapRestoreDialogComponent } from './components/map-restore-dialog.component';
import { MapComponent } from './components/map.component';
import { TYPE_PROVIDER } from '../file-browser/services/object-type.service';
import { MapTypeProvider } from './providers/map.type-provider';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { InfoViewPanelComponent } from './components/info-view-panel.component';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { GraphEntityDataProvider } from './providers/data-transfer-data/graph-entity-data.provider';
import { LinkEditDialogComponent } from './components/map-editor/dialog/link-edit-dialog.component';

@NgModule({
  declarations: [
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapComponent,
    MapViewComponent,
    NodeFormComponent,
    EdgeFormComponent,
    MapRestoreDialogComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
  ],
  entryComponents: [
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
    MapComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  providers: [
    {
      provide: TYPE_PROVIDER,
      useClass: MapTypeProvider,
      multi: true,
    },
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: GraphEntityDataProvider,
      multi: true,
    },
  ],
  exports: [
    RouterModule,
    MapComponent,
  ],
})
export class DrawingToolModule {
}
