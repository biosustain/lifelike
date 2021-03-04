import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { EnrichmentVisualisationCloudViewerComponent } from './enrichment-visualisation-cloud-viewer.component';
import { WordCloudModule } from '../../../../shared/components/word-cloud/word-cloud.module';

const components = [
  EnrichmentVisualisationCloudViewerComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
    WordCloudModule
  ],
  exports: components,
})
export class EnrichmentVisualisationCloudViewerModule {

}
