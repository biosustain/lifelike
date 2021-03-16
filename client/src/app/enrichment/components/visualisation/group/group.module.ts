import { NgModule } from '@angular/core';
import { GroupComponent } from './group.component';
import { SharedModule } from '../../../../shared/shared.module';
import { ChartModule } from './chart/chart.module';
import { WordCloudModule } from '../../../../shared/components/word-cloud/word-cloud.module';
import { TableCompleteComponentModule } from './table/table-complete.module';
import { ClustergramModule } from './clustergram/clustergram.module';
import { CommonModule } from '@angular/common';
import { SdfgsdfcloudViewerModule } from './word-cloud/sdfgsdfcloud-viewer.module';

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
    SdfgsdfcloudViewerModule
  ],
  exports: [
    GroupComponent
  ]
})
export class GroupModule {
}
