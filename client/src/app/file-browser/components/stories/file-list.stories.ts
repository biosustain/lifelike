import {moduleMetadata, Story} from '@storybook/angular';
import {Subject} from 'rxjs';
import {withKnobs} from '@storybook/addon-knobs';
import {ColorChooserComponent} from "../../../shared/components/form/color-chooser.component";
import {FormInputFeedbackComponent} from "../../../shared/components/form/form-input-feedback.component";
import {FormRowComponent} from "../../../shared/components/form/form-row.component";
import {PercentInputComponent} from "../../../shared/components/form/percent-input.component";
import {SelectComponent} from "../../../shared/components/form/select.component";
import {FileListComponent} from "../file-list.component";
import {EnrichmentVisualisationCreateDialogComponent} from "../enrichment-visualisation-create-dialog.component";
import {MapCreateDialogComponent} from "../../../drawing-tool/components/map-create-dialog.component";
import {MapDeleteDialogComponent} from "../../../drawing-tool/components/map-delete-dialog.component";
import {MapCloneDialogComponent} from "../../../drawing-tool/components/map-clone-dialog.component";
import {MapUploadDialogComponent} from "../../../drawing-tool/components/map-upload-dialog.component";
import {MapVersionDialogComponent} from "../../../drawing-tool/components/map-version-dialog.component";
import {MapEditorComponent} from "../../../drawing-tool/components/map-editor/map-editor.component";
import {PaletteComponent} from "../../../drawing-tool/components/map-editor/palette.component";
import {InfoPanelComponent} from "../../../drawing-tool/components/map-editor/info-panel.component";
import {MapComponent} from "../../../drawing-tool/components/map.component";
import {MapViewComponent} from "../../../drawing-tool/components/map-view.component";
import {MapExportDialogComponent} from "../../../drawing-tool/components/map-export-dialog.component";
import {NodeFormComponent} from "../../../drawing-tool/components/map-editor/node-form.component";
import {EdgeFormComponent} from "../../../drawing-tool/components/map-editor/edge-form.component";
import {MapEditDialogComponent} from "../../../drawing-tool/components/map-edit-dialog.component";
import {MapRestoreDialogComponent} from "../../../drawing-tool/components/map-restore-dialog.component";
import {SharedNgrxEffects} from "../../../shared/store/effects";
import {RootStoreModule} from "../../../***ARANGO_USERNAME***-store";
import {SharedModule} from "../../../shared/shared.module";
import {CopyPasteMapsService} from "../../../drawing-tool/services/copy-paste-maps.service";
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbActiveModal, NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {EffectsModule} from '@ngrx/effects';
import {MatSnackBar} from '@angular/material/snack-bar';

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'FileListComponent',  // The component related to the Stories
  component: FileListComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        FileListComponent,
        ColorChooserComponent,
        FormInputFeedbackComponent,
        FormRowComponent,
        PercentInputComponent,
        SelectComponent,
        EnrichmentVisualisationCreateDialogComponent,
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
        MapRestoreDialogComponent
      ],
      imports: [
        EffectsModule.forRoot([SharedNgrxEffects]),
        FormsModule,
        ReactiveFormsModule,
        RootStoreModule,
        SharedModule,
        NgbModule,
      ],
      providers: [
        CopyPasteMapsService,
        MatSnackBar,
        SharedNgrxEffects,
        NgbActiveModal
      ]
    }),
  ]
};// This creates a Story for the component

const Template: Story<FileListComponent> = (args) => ({
  component: FileListComponent,
  props: {
    annotations: [],
    goToPosition: new Subject<Location>(),
    highlightAnnotations: new Subject<string>(),
    entityTypeVisibilityMap: new Map(),
    currentHighlightAnnotationId: undefined,
    searchChanged: new Subject<{ keyword: string, findPrevious: boolean }>(),
    ...args
  },
  template: `<app-enrichment-visualisation-viewer>
            </app-enrichment-visualisation-viewer>`,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {};
