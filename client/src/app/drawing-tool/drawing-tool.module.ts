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
  ],
  entryComponents: [
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
  ],
  imports: [
    SharedModule,
  ],
  providers: [],
  exports: [
    RouterModule,
    MapComponent,
  ],
})
export class DrawingToolModule {
}
