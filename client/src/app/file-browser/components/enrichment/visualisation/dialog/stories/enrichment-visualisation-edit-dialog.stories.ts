import {moduleMetadata, Story} from '@storybook/angular';
import {Subject} from 'rxjs';
import {withKnobs} from '@storybook/addon-knobs';
import {NgbActiveModal, NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {EffectsModule} from '@ngrx/effects';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SharedNgrxEffects} from "../../../../../../shared/store/effects";
import {MapEditorComponent} from "../../../../../../drawing-tool/components/map-editor/map-editor.component";
import {MapRestoreDialogComponent} from "../../../../../../drawing-tool/components/map-restore-dialog.component";
import {EnrichmentVisualisationEditDialogComponent} from "../enrichment-visualisation-edit-dialog.component";
import {RootStoreModule} from "../../../../../../root-store";
import {PaletteComponent} from "../../../../../../drawing-tool/components/map-editor/palette.component";
import {SharedModule} from "../../../../../../shared/shared.module";
import {MapViewComponent} from "../../../../../../drawing-tool/components/map-view.component";
import {MapComponent} from "../../../../../../drawing-tool/components/map.component";
import {NodeFormComponent} from "../../../../../../drawing-tool/components/map-editor/node-form.component";
import {EdgeFormComponent} from "../../../../../../drawing-tool/components/map-editor/edge-form.component";
import {InfoPanelComponent} from "../../../../../../drawing-tool/components/map-editor/info-panel.component";

// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Enrichment/Visualisation/DialogComponent/Edit',  // The component related to the Stories
  component: EnrichmentVisualisationEditDialogComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        EnrichmentVisualisationEditDialogComponent,
        MapEditorComponent,
        PaletteComponent,
        InfoPanelComponent,
        MapComponent,
        MapViewComponent,
        NodeFormComponent,
        EdgeFormComponent,
        MapRestoreDialogComponent
      ],
      imports: [
        EffectsModule.forRoot([SharedNgrxEffects]),
        RootStoreModule,
        SharedModule,
        NgbModule,
      ],
      providers: [
        MatSnackBar,
        SharedNgrxEffects,
        NgbActiveModal
      ]
    }),
  ]
}; // This creates a Story for the component

const Template: Story<EnrichmentVisualisationEditDialogComponent> = (args) => ({
  component: EnrichmentVisualisationEditDialogComponent,
  props: {
    annotations: [],
    goToPosition: new Subject<Location>(),
    highlightAnnotations: new Subject<string>(),
    entityTypeVisibilityMap: new Map(),
    currentHighlightAnnotationId: undefined,
    searchChanged: new Subject<{ keyword: string, findPrevious: boolean }>(),
    ...args
  },
  template: `<app-enrichment-visualisation-edit-dialog>
            </app-enrichment-visualisation-edit-dialog>`,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {};
