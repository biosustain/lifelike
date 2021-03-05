import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from '../file-browser/file-browser.module';
import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';
import { GroupModule } from './components/visualisation/group/group.module';
import { CloudViewerModule } from './components/visualisation/word-cloud/cloud-viewer.module';

@NgModule({
  declarations: [
    EnrichmentVisualisationViewerComponent
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    GroupModule,
    CloudViewerModule
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
