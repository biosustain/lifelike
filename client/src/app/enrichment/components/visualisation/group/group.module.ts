import { NgModule } from '@angular/core';
import { EnrichmentVisualisationGroupComponent } from './enrichment-visualisation-group.component';
import { SharedModule } from '../../../../shared/shared.module';
import { FileBrowserModule } from '../../../../file-browser/file-browser.module';
import { ChartModule } from './chart/chart.module';
import { WordCloudModule } from '../../../../shared/components/word-cloud/word-cloud.module';
import { TableCompleteComponentModule } from './table/table-complete.module';
import { ClustergramModule } from './clustergram/clustergram.module';

@NgModule({
  declarations: [
    EnrichmentVisualisationGroupComponent
  ],
  imports: [
    SharedModule,
    ChartModule,
    WordCloudModule,
    TableCompleteComponentModule,
    ClustergramModule
  ],
  exports: [
    EnrichmentVisualisationGroupComponent
  ]
})
export class EnrichmentVisualisationGroupModule {
}
