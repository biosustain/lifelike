import {moduleMetadata, Story} from '@storybook/angular';
import {Observable, Subject} from 'rxjs';
import {withKnobs} from '@storybook/addon-knobs';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbActiveModal, NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {EffectsModule} from '@ngrx/effects';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ActivatedRoute} from '@angular/router';
import {EnrichmentVisualisationViewerComponent} from '../enrichment-visualisation-viewer.component';
import {EnrichmentVisualisationService} from '../../../../services/enrichment-visualisation.service';
import {SharedNgrxEffects} from '../../../../../shared/store/effects';
import {MapEditorComponent} from '../../../../../drawing-tool/components/map-editor/map-editor.component';
import {MapRestoreDialogComponent} from '../../../../../drawing-tool/components/map-restore-dialog.component';
import {RootStoreModule} from '../../../../../root-store';
import {PaletteComponent} from '../../../../../drawing-tool/components/map-editor/palette.component';
import {SharedModule} from '../../../../../shared/shared.module';
import {MapViewComponent} from '../../../../../drawing-tool/components/map-view.component';
import {MapComponent} from '../../../../../drawing-tool/components/map.component';
import {NodeFormComponent} from '../../../../../drawing-tool/components/map-editor/node-form.component';
import {EdgeFormComponent} from '../../../../../drawing-tool/components/map-editor/edge-form.component';
import {PdfFilesService} from '../../../../../shared/services/pdf-files.service';
import {InfoPanelComponent} from '../../../../../drawing-tool/components/map-editor/info-panel.component';
import {EnrichmentVisualisationOrderDialogComponent} from '../dialog/enrichment-visualisation-order-dialog.component';
import {WordCloudModule} from "../word-cloud/word-cloud.module";
import {ObjectPathComponent} from "../../../object-path.component";

import mockedData from "./assets/mocked_data.json";
import {ChartModule} from "../chart/chart.module";
import {ChartsModule} from "ng2-charts";
import {ObjectMenuComponent} from "../../../object-menu.component";
import {ProjectIconComponent} from "../../../project-icon.component";
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
        MapEditorComponent,
        PaletteComponent,
        InfoPanelComponent,
        MapComponent,
        MapViewComponent,
        NodeFormComponent,
        EdgeFormComponent,
        MapRestoreDialogComponent,
        EnrichmentVisualisationOrderDialogComponent,
        ObjectMenuComponent,
        ObjectPathComponent,
        ProjectIconComponent
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
              ]);
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
              ]);
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
              });
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
}; // This creates a Story for the component

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

export const Default = Template.bind({}); // Other stories could be added here as well, all you have to do is export them along!
Default.args = {
  data: mockedData
};
