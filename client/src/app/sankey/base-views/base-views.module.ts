import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SankeySingleLaneOverwriteModule } from './single-lane/sankey-viewer-lib.module';
import { MultiLaneBaseModule } from './multi-lane/sankey-viewer-lib.module';

@NgModule({
  imports: [
    SankeySingleLaneOverwriteModule,
    MultiLaneBaseModule,
    CommonModule
  ]
})
export class BaseViewsModule {
}
