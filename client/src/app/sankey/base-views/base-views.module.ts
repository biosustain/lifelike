import { NgModule } from '@angular/core';

import { SankeySingleLaneOverwriteModule } from './single-lane/sankey-viewer-lib.module';
import { MultiLaneBaseModule } from './multi-lane/sankey-viewer-lib.module';

@NgModule({
  imports: [
    SankeySingleLaneOverwriteModule,
    MultiLaneBaseModule
  ]
})
export class BaseViewsModule {
}
