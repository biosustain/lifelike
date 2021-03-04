import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';
import { EnrichmentVisualisationGroupModule } from './components/visualisation/group/enrichment-visualisation-group.module';
import { EnrichmentVisualisationCloudViewerModule } from './components/visualisation/word-cloud/enrichment-visualisation-cloud-viewer.module';

@NgModule({
  declarations: [
    EnrichmentVisualisationViewerComponent
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    EnrichmentVisualisationGroupModule,
    EnrichmentVisualisationCloudViewerModule
  ],
  exports: [
    EnrichmentVisualisationViewerComponent
  ],
  providers: [
    EnrichmentVisualisationService
  ],
})
export class EnrichmentVisualisationsModule {
}
