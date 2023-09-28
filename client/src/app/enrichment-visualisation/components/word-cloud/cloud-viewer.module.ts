import { NgModule } from '@angular/core';

import { EnrichmentWordCloudModule } from 'app/enrichment-visualisation/modules/enrichment-word-cloud';

import { CloudViewerComponent } from './cloud-viewer.component';

const exports = [CloudViewerComponent];

@NgModule({
  imports: [EnrichmentWordCloudModule],
  declarations: [...exports],
  exports,
})
export class CloudViewerModule {}
