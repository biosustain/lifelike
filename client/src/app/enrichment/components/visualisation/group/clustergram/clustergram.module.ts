import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { ClustergramComponent } from './clustergram.component';
import { LinkModule } from '../../components/link/link.module';
import { CdkFixedSizeGridVirtualScroll } from './gridScroll/fixed-size-grid-virtual-scroll';
import { CdkVirtualScrollViewport } from './gridScroll/virtual-scroll-viewport';

const components = [
  ClustergramComponent
];

@NgModule({
  declarations: [
    components,
    CdkFixedSizeGridVirtualScroll,
    CdkVirtualScrollViewport
  ],
  imports: [
    CommonModule,
    SharedModule,
    LinkModule
  ],
  exports: components,
})
export class ClustergramModule {
}
