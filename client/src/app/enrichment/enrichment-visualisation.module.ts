import { NgModule } from '@angular/core';

import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { SharedModule } from 'app/shared/shared.module';

// tslint:disable-next-line:max-line-length
import { EnrichmentVisualisationExplanationPanelComponent } from './components/visualisation/components/explanation-panel/explanation-panel.component';
// tslint:disable-next-line:max-line-length
import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { GroupModule } from './components/visualisation/group/group.module';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';

@NgModule({
  declarations: [
    EnrichmentVisualisationExplanationPanelComponent,
    EnrichmentVisualisationViewerComponent,
  ],
  imports: [SharedModule, FileBrowserModule, GroupModule],
  exports: [EnrichmentVisualisationViewerComponent],
  providers: [EnrichmentVisualisationService],
})
export class EnrichmentVisualisationsModule {}
