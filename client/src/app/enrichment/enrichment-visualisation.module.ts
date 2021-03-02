import {NgModule} from '@angular/core';
import {SharedModule} from 'app/shared/shared.module';
import {FileBrowserModule} from '../file-browser/file-browser.module';
import {TYPE_PROVIDER} from '../file-browser/services/object-type.service';
import {EnrichmentVisualisationViewerComponent} from './components/visualisation/enrichment-visualisation-viewer.component';
import {
  EnrichmentVisualisationEditDialogComponent
} from './components/visualisation/dialog/enrichment-visualisation-edit-dialog.component';
import {
  EnrichmentVisualisationOrderDialogComponent
} from './components/visualisation/dialog/enrichment-visualisation-order-dialog.component';
import {EnrichmentVisualisationService} from './services/enrichment-visualisation.service';
import {EnrichmentVisualisationTypeProvider} from './providers/enrichment-visualisation.type-provider';
import {ChartModule} from './components/visualisation/chart/chart.module';
import {WordCloudModule} from './components/visualisation/word-cloud/word-cloud.module';
import {EnrichmentTableViewerComponent} from './components/visualisation/table/enrichment-table-viewer.component';
import {
  EnrichmentVisualisationChartViewerComponent
} from './components/visualisation/enrichment-visualisation-chart-viewer.component';
import {
  EnrichmentVisualisationCloudViewerComponent
} from './components/visualisation/enrichment-visualisation-cloud-viewer.component';
import { EnrichmentVisualisationGroupComponent } from './components/visualisation/enrichment-visualisation-group.component';
import { NgbdTableCompleteModule } from './components/visualisation/table/table/table-complete.module';
import { ClustergramModule } from './components/visualisation/clustergram/clustergram.module';

@NgModule({
  declarations: [
    EnrichmentVisualisationViewerComponent,
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
    EnrichmentTableViewerComponent,
    EnrichmentVisualisationChartViewerComponent,
    EnrichmentVisualisationCloudViewerComponent,
    EnrichmentVisualisationGroupComponent
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    ChartModule,
    WordCloudModule,
    NgbdTableCompleteModule,
    ClustergramModule
  ],
  entryComponents: [
    EnrichmentVisualisationEditDialogComponent,
    EnrichmentVisualisationOrderDialogComponent,
  ],
  exports: [],
  providers: [
    EnrichmentVisualisationService, {
      provide: TYPE_PROVIDER,
      useClass: EnrichmentVisualisationTypeProvider,
      multi: true,
    }],
})
export class EnrichmentVisualisationsModule {
}
