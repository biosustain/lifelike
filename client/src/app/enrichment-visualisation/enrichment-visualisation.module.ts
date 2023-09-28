import { NgModule } from '@angular/core';

import { NgbNavModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { SharedModule } from 'app/shared/shared.module';
import { PlaygroundModule } from 'app/playground/playground.module';
import { EnrichmentWordCloudModule } from 'app/enrichment-visualisation/modules/enrichment-word-cloud';
import {
  EnrichmentPromptFormComponent
} from 'app/enrichment-visualisation/modules/enrichment-prompt-form/enrichment-prompt-form.component';

import { EnrichmentVisualisationExplanationPanelComponent } from './components/explanation-panel/explanation-panel.component';
import { EnrichmentVisualisationViewerComponent } from './components/viewer/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';
import { ChartModule } from './components/chart/chart.module';
import { TableCompleteComponentModule } from './components/table/table-complete.module';
import { ClustergramModule } from './components/clustergram/clustergram.module';
import { CloudViewerModule } from './components/word-cloud/cloud-viewer.module';
import { GroupComponent } from './components/group/group.component';
import EnrichmentPromptFormModule from './modules/enrichment-prompt-form';

const exports = [EnrichmentVisualisationViewerComponent];

@NgModule({
  imports: [
    SharedModule,
    FileBrowserModule,
    PlaygroundModule,
    ChartModule,
    TableCompleteComponentModule,
    ClustergramModule,
    CloudViewerModule,
    NgbNavModule,
    NgbPaginationModule,
    EnrichmentPromptFormModule,
  ],
  declarations: [EnrichmentVisualisationExplanationPanelComponent, GroupComponent, ...exports],
  entryComponents: [EnrichmentPromptFormComponent],
  providers: [EnrichmentVisualisationService],
  exports,
})
export class EnrichmentVisualisationsModule {}
