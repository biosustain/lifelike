import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppGridVirtualScrollViewportComponent } from './app-grid-virtual-scroll-viewport.component';
import { AppFixedSizeGridVirtualScroll } from './fixed-size-grid-virtual-scroll';
import { PlatformModule } from '@angular/cdk/platform';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BidiModule } from '@angular/cdk/bidi';

@NgModule({
  imports: [
    CommonModule,
    PlatformModule,
    BidiModule
  ],
  declarations: [
    AppGridVirtualScrollViewportComponent,
    AppFixedSizeGridVirtualScroll
  ],
  exports: [
    AppGridVirtualScrollViewportComponent,
    AppFixedSizeGridVirtualScroll
  ],
  providers: [
    {
      provide: CdkVirtualScrollViewport,
      useClass: AppGridVirtualScrollViewportComponent
    }
  ]
})
export class GridScrollModule {
}
