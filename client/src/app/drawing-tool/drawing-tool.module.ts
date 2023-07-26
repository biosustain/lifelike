import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { PlaygroundModule } from 'app/playground/playground.module';

import { MapEditorComponent } from './components/map-editor/map-editor.component';
import { PaletteComponent } from './components/map-editor/palette.component';
import { InfoPanelComponent } from './components/map-editor/info-panel.component';
import { MapViewComponent } from './components/map-view.component';
import { NodeFormComponent } from './components/map-editor/forms/node-form.component';
import { EdgeFormComponent } from './components/map-editor/forms/edge-form.component';
import { GroupFormComponent } from './components/map-editor/forms/group-form.component';
import { MultiselectFormComponent } from './components/map-editor/forms/multiselect-form.component';
import { MapRestoreDialogComponent } from './components/map-restore-dialog.component';
import { MapComponent } from './components/map.component';
import { InfoViewPanelComponent } from './components/info-view-panel.component';
import { GraphEntityDataProvider } from './providers/graph-entity-data.provider';
import { LinkEditDialogComponent } from './components/map-editor/dialog/link-edit-dialog.component';
import { MapImageProviderService } from './services/map-image-provider.service';
import { ImageEntityDataProvider } from './providers/image-entity-data.provider';
import { GraphActionsService } from './services/graph-actions.service';
import { ImageUploadDataProvider } from './providers/image-upload-data.provider';
import { GraphViewDirective } from './directives/graph-view.directive';
import { LinksPanelComponent } from './components/links-panel.component';
import { DrawingToolPromptComponent } from './components/prompt/prompt.component';

@NgModule({
  declarations: [
    LinksPanelComponent,
    DrawingToolPromptComponent,
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapComponent,
    MapViewComponent,
    NodeFormComponent,
    EdgeFormComponent,
    GroupFormComponent,
    MultiselectFormComponent,
    MapRestoreDialogComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
    GraphViewDirective,
  ],
  entryComponents: [
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
    MapComponent,
    LinksPanelComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
  ],
  imports: [SharedModule, FileBrowserModule, PlaygroundModule],
  providers: [
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: GraphEntityDataProvider,
      multi: true,
    },
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: ImageEntityDataProvider,
      multi: true,
    },
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: ImageUploadDataProvider,
      multi: true,
    },
    MapImageProviderService,
    GraphActionsService,
  ],
  exports: [RouterModule, MapComponent],
})
export class DrawingToolModule {}
