import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { CloudViewerComponent } from './cloud-viewer.component';
import { WordCloudModule } from '../../../../shared/components/word-cloud/word-cloud.module';

const components = [
  CloudViewerComponent
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
