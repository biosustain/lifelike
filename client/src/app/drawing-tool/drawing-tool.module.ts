import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { NgbDropdownModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

import { SharedModule } from 'app/shared/shared.module';
import { ConfirmDialogComponent } from 'app/shared/modules/dialog/components/confirm/confirm-dialog.component';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { PlaygroundModule } from 'app/playground/playground.module';
import { DrawingToolPromptFormComponent } from 'app/drawing-tool/modules/drawing-tool-prompt-form/drawing-tool-prompt-form.component';

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
import { DrawingToolPromptComponent } from './components/prompt/prompt.component';
import { ColorChooserComponent } from './components/form/color-chooser/color-chooser.component';
import { FriendlyDateStrPipe } from './pipes/friendly-date-str.pipe';
import { QuickSearchComponent } from './components/quick-search/quick-search.component';
import DrawingToolPromptFormModule from './modules/drawing-tool-prompt-form';

const exports = [MapComponent];

@NgModule({
  imports: [
    SharedModule,
    FileBrowserModule,
    PlaygroundModule,
    NgbNavModule,
    NgbDropdownModule,
    DrawingToolPromptFormModule,
  ],
  declarations: [
    DrawingToolPromptComponent,
    ColorChooserComponent,
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapViewComponent,
    NodeFormComponent,
    EdgeFormComponent,
    GroupFormComponent,
    MultiselectFormComponent,
    MapRestoreDialogComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
    GraphViewDirective,
    FriendlyDateStrPipe,
    QuickSearchComponent,
    ...exports,
  ],
  entryComponents: [
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
    MapComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
    DrawingToolPromptFormComponent,
  ],
  providers: [
    MapImageProviderService,
    GraphActionsService,
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
  ],
  exports,
})
export class DrawingToolModule {}
