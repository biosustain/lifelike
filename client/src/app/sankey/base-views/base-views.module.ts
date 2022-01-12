import { NgModule } from '@angular/core';

import { SankeySingleLaneOverwriteModule } from './single-lane/sankey-viewer-lib.module';
import { SankeyMultiLaneOverwriteModule } from './multi-lane/sankey-viewer-lib.module';

@NgModule({
  imports: [
    SankeySingleLaneOverwriteModule,
    SankeyMultiLaneOverwriteModule
  ]
})
export class BaseViewsModule {
}
