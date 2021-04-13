import { NgModule } from '@angular/core';
import { GroupComponent } from './group.component';
import { SharedModule } from 'app/shared/shared.module';
import { ChartModule } from './chart/chart.module';
import { WordCloudModule } from 'app/shared/components/word-cloud/word-cloud.module';
import { TableCompleteComponentModule } from './table/table-complete.module';
import { ClustergramModule } from './clustergram/clustergram.module';
import { CommonModule } from '@angular/common';
import { CloudViewerModule } from './word-cloud/cloud-viewer.module';

@NgModule({
  declarations: [
    GroupComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ChartModule,
    WordCloudModule,
    TableCompleteComponentModule,
    ClustergramModule,
    CloudViewerModule
  ],
  exports: [
    GroupComponent
  ]
})
export class GroupModule {
}
