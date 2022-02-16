import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SingleLaneBaseModule } from './single-lane/sankey-viewer-lib.module';
import { MultiLaneBaseModule } from './multi-lane/sankey-viewer-lib.module';

@NgModule({
  imports: [
    SingleLaneBaseModule,
    MultiLaneBaseModule,
    CommonModule
  ]
})
export class BaseViewsModule {
}
