import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { EnrichmentWordCloudComponent } from './components/enrichment-word-cloud.component';

const exports = [EnrichmentWordCloudComponent];

@NgModule({
  imports: [SharedModule],
  declarations: [...exports],
  exports,
})
export class EnrichmentWordCloudModule {}
