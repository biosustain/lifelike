import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';
import { GroupModule } from './components/visualisation/group/group.module';
import {
  EnrichmentVisualisationExplanationPanelComponent
} from './components/visualisation/components/explanation-panel/explanation-panel.component';

@NgModule({
  declarations: [
    EnrichmentVisualisationExplanationPanelComponent,
    EnrichmentVisualisationViewerComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    GroupModule,
  ],
  exports: [
    EnrichmentVisualisationViewerComponent,
  ],
  providers: [
    EnrichmentVisualisationService,
  ],
})
export class EnrichmentVisualisationsModule {
}
