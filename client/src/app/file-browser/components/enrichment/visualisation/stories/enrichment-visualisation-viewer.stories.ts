import {moduleMetadata, Story} from '@storybook/angular';
import {Observable, Subject} from 'rxjs';
import {withKnobs} from '@storybook/addon-knobs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MapCreateDialogComponent} from "../../../../../drawing-tool/components/map-create-dialog.component";
import {MapDeleteDialogComponent} from "../../../../../drawing-tool/components/map-delete-dialog.component";
import {MapCloneDialogComponent} from "../../../../../drawing-tool/components/map-clone-dialog.component";
import {MapUploadDialogComponent} from "../../../../../drawing-tool/components/map-upload-dialog.component";
import {MapVersionDialogComponent} from "../../../../../drawing-tool/components/map-version-dialog.component";
import {MapEditorComponent} from "../../../../../drawing-tool/components/map-editor/map-editor.component";
import {PaletteComponent} from "../../../../../drawing-tool/components/map-editor/palette.component";
import {InfoPanelComponent} from "../../../../../drawing-tool/components/map-editor/info-panel.component";
import {MapComponent} from "../../../../../drawing-tool/components/map.component";
import {MapViewComponent} from "../../../../../drawing-tool/components/map-view.component";
import {MapExportDialogComponent} from "../../../../../drawing-tool/components/map-export-dialog.component";
import {NodeFormComponent} from "../../../../../drawing-tool/components/map-editor/node-form.component";
import {EdgeFormComponent} from "../../../../../drawing-tool/components/map-editor/edge-form.component";
import {MapEditDialogComponent} from "../../../../../drawing-tool/components/map-edit-dialog.component";
import {MapRestoreDialogComponent} from "../../../../../drawing-tool/components/map-restore-dialog.component";
import {SharedModule} from "../../../../../shared/shared.module";
import {SharedNgrxEffects} from "../../../../../shared/store/effects";
import {CopyPasteMapsService} from "../../../../../drawing-tool/services/copy-paste-maps.service";
import {NgbActiveModal, NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {EffectsModule} from '@ngrx/effects';
import {MatSnackBar} from '@angular/material/snack-bar';
import {RootStoreModule} from "../../../../../root-store";
import {EnrichmentVisualisationViewerComponent} from "../enrichment-visualisation-viewer.component";
import {ActivatedRoute} from '@angular/router';
import {PdfFilesService} from "../../../../../shared/services/pdf-files.service";
import {EnrichmentVisualisationService} from "../../../../services/enrichment-visualisation.service";
import {EnrichmentVisualisationOrderDialogComponent} from "../dialog/enrichment-visualisation-order-dialog.component";
import {WordCloudModule} from "../word-cloud/word-cloud.module";
import mockedData from "./assets/mocked_data.json";
import {ChartModule} from "../chart/chart.module";
import {ChartsModule} from "ng2-charts";
// This exports the Stories group for this component
export default {
  // The title defines the name and where in the structure of
  // Storybook's menu this is going to be placed.
  // Here we add it to a "Components" section under "Link"
  title: 'Enrichment/Visualisation/ViewerComponent',  // The component related to the Stories
  component: EnrichmentVisualisationViewerComponent, decorators: [
    withKnobs,
    // The necessary modules for the component to work on Storybook
    moduleMetadata({
      declarations: [
        EnrichmentVisualisationViewerComponent,
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
        EnrichmentVisualisationOrderDialogComponent
      ],
      entryComponents: [
        EnrichmentVisualisationOrderDialogComponent
      ],
      imports: [
        EffectsModule.forRoot([SharedNgrxEffects]),
        FormsModule,
        ReactiveFormsModule,
        RootStoreModule,
        SharedModule,
        NgbModule,
        WordCloudModule,
        ChartModule,
        ChartsModule
      ],
      providers: [
        CopyPasteMapsService,
        MatSnackBar,
        SharedNgrxEffects,
        NgbActiveModal,
        {
          provide: EnrichmentVisualisationService,
          useValue: {
            matchNCBINodes: () => new Observable(s => {
              s.next([
                {
                  s: 'a',
                  x: 'b',
                  neo4jID: 'c',
                  link: 'd'
                }
              ])
            }),
            getNCBIEnrichmentDomains: () => new Observable(s => {
              s.next([
                {
                  s: 'a',
                  x: 'b',
                  neo4jID: 'c',
                  link: 'd',
                  regulon: {
                    result: {
                      regulator_family: 'e'
                    },
                    s: 'a',
                    x: 'b',
                    neo4jID: 'c',
                    link: 'd',
                  },
                  uniprot: {
                    result: {
                      regulator_family: 'e'
                    },
                    s: 'a',
                    x: 'b',
                    neo4jID: 'c',
                    link: 'd',
                  },
                  string: {
                    result: {
                      annotation: 'f'
                    }
                  },
                  biocyc: {
                    result: {
                      biocyc_id: 'g'
                    }
                  },
                  go: {
                    result: [
                      {
                        id: 'def',
                        name: 'i'
                      }
                    ],
                    link: 'h'
                  }
                }
              ])
            }),
          }
        },
        {
          provide: PdfFilesService,
          useValue: {
            getEnrichmentData: () => new Observable(s => {
              s.next({
                name: 'abc',
                data: 'def/ghi'
              })
            }),
            getFileMeta: (fileId, projectName) => {

            }
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              params: {
                project_name: ''
              }
            }
          }
        }
      ]
    }),
  ]
};// This creates a Story for the component

const Template: Story<EnrichmentVisualisationViewerComponent> = (args) => ({
  component: EnrichmentVisualisationViewerComponent,
  props: {
    annotations: [],
    goToPosition: new Subject<Location>(),
    highlightAnnotations: new Subject<string>(),
    entityTypeVisibilityMap: new Map(),
    currentHighlightAnnotationId: undefined,
    searchChanged: new Subject<{ keyword: string, findPrevious: boolean }>(),
    ...args
  },
  template: `
    <app-enrichment-visualisation-viewer
        style='display:block;height:100vh;'
        [data]="data"
    >
    </app-enrichment-visualisation-viewer>
  `,
});

export const Default = Template.bind({});// Other stories could be added here as well, all you have to do is export them along!
Default.args = {
  data: mockedData
};
