/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Directive, forwardRef, Input, OnChanges, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { AppGridVirtualScrollViewportComponent } from './app-grid-virtual-scroll-viewport.component';
import { VirtualScrollStrategy, VIRTUAL_SCROLL_STRATEGY } from '@angular/cdk/scrolling';
import { coerceNumberProperty } from '@angular/cdk/coercion';

/** Virtual scrolling strategy for lists with items of known fixed size. */
@Injectable()
export class FixedSizeGridVirtualScrollStrategy implements VirtualScrollStrategy {
  private readonly _scrolledIndexChange = new Subject<number[]>();

  /** @docs-private Implemented as part of XYVirtualScrollStrategy. */
  // @ts-ignore
  scrolledIndexChange: Observable<number[]> = this._scrolledIndexChange.pipe(distinctUntilChanged());

  /** The attached viewport. */
  private _viewport: AppGridVirtualScrollViewportComponent | null = null;

  /** The size of the items in the virtually scrolling list. */
  private _itemSize: number[];

  /** The minimum amount of buffer rendered beyond the viewport (in pixels). */
  private _minBufferPx: number;

  /** The number of buffer items to render beyond the edge of the viewport (in pixels). */
  private _maxBufferPx: number;

  /**
   * @param itemSize The size of the items in the virtually scrolling list.
   * @param minBufferPx The minimum amount of buffer (in pixels) before needing to render more
   * @param maxBufferPx The amount of buffer (in pixels) to render when rendering more.
   */
  constructor(itemSize: number[], minBufferPx: number, maxBufferPx: number) {
    this._itemSize = itemSize;
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
  }

  /**
   * Attaches this scroll strategy to a viewport.
   * @param viewport The viewport to attach this strategy to.
   */
  attach(viewport) {
    this._viewport = viewport;
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  /** Detaches this scroll strategy from the currently attached viewport. */
  detach() {
    this._scrolledIndexChange.complete();
    this._viewport = null;
  }

  /**
   * Update the item size and buffer size.
   * @param itemSize The size of the items in the virtually scrolling list.
   * @param minBufferPx The minimum amount of buffer (in pixels) before needing to render more
   * @param maxBufferPx The amount of buffer (in pixels) to render when rendering more.
   */
  updateItemAndBufferSize(itemSize: number[], minBufferPx: number, maxBufferPx: number) {
    if (maxBufferPx < minBufferPx) {
      throw Error('CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx');
    }
    this._itemSize = itemSize;
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  /** @docs-private Implemented as part of XYVirtualScrollStrategy. */
  onContentScrolled() {
    this._updateRenderedRange();
  }

  /** @docs-private Implemented as part of XYVirtualScrollStrategy. */
  onDataLengthChanged() {
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  /** @docs-private Implemented as part of XYVirtualScrollStrategy. */
  onContentRendered() { /* no-op */
  }

  /** @docs-private Implemented as part of XYVirtualScrollStrategy. */
  onRenderedOffsetChanged() { /* no-op */
  }

  /**
   * Scroll to the offset for the given index.
   * @param index The index of the element to scroll to.
   * @param behavior The ScrollBehavior to use when scrolling.
   */
  // @ts-ignore
  scrollToIndex(index: number[], behavior: ScrollBehavior): void {
    if (this._viewport) {
      this._viewport.scrollToOffset(this._itemSize.map((s, i) => s * index[i]), behavior);
    }
  }

  /** Update the viewport's total content size. */
  private _updateTotalContentSize() {
    if (!this._viewport) {
      return;
    }

    this._viewport.setTotalContentSize(this._viewport.getDataLength().map((v, i) => v * this._itemSize[i]));
  }

  /** Update the viewport's rendered range. */
  private _updateRenderedRangeAxis(renderedRange, viewportSize, dataLength, scrollOffset, _itemSize) {
    const newRange = {start: renderedRange.start, end: renderedRange.end};
    // Prevent NaN as result when dividing by zero.
    let firstVisibleIndex = (_itemSize > 0) ? scrollOffset / _itemSize : 0;

    // If user scrolls to the bottom of the list and data changes to a smaller list
    if (newRange.end > dataLength) {
      // We have to recalculate the first visible index based on new data length and viewport size.
      const maxVisibleItems = Math.ceil(viewportSize / _itemSize);
      const newVisibleIndex = Math.max(0,
        Math.min(firstVisibleIndex, dataLength - maxVisibleItems));

      // If first visible index changed we must update scroll offset to handle start/end buffers
      // Current range must also be adjusted to cover the new position (bottom of new list).
      if (firstVisibleIndex !== newVisibleIndex) {
        firstVisibleIndex = newVisibleIndex;
        scrollOffset = newVisibleIndex * _itemSize;
        newRange.start = Math.floor(firstVisibleIndex);
      }

      newRange.end = Math.max(0, Math.min(dataLength, newRange.start + maxVisibleItems));
    }

    const startBuffer = scrollOffset - newRange.start * _itemSize;
    if (startBuffer < this._minBufferPx && newRange.start !== 0) {
      const expandStart = Math.ceil((this._maxBufferPx - startBuffer) / _itemSize);
      newRange.start = Math.max(0, newRange.start - expandStart);
      newRange.end = Math.min(dataLength,
        Math.ceil(firstVisibleIndex + (viewportSize + this._minBufferPx) / _itemSize));
    } else {
      const endBuffer = newRange.end * _itemSize - (scrollOffset + viewportSize);
      if (endBuffer < this._minBufferPx && newRange.end !== dataLength) {
        const expandEnd = Math.ceil((this._maxBufferPx - endBuffer) / _itemSize);
        if (expandEnd > 0) {
          newRange.end = Math.min(dataLength, newRange.end + expandEnd);
          newRange.start = Math.max(0,
            Math.floor(firstVisibleIndex - this._minBufferPx / _itemSize));
        }
      }
    }
    return {
      newRange, firstVisibleIndex
    };
  }

  /** Update the viewport's rendered range. */
  private _updateRenderedRange() {
    if (!this._viewport) {
      return;
    }

    const renderedRange = this._viewport.getRenderedRange();
    const viewportSize = this._viewport.getViewportSize();
    const dataLength = this._viewport.getDataLength();
    const scrollOffset = this._viewport.measureScrollOffset();

    const result = [0, 1].map(i => this._updateRenderedRangeAxis(
      renderedRange[i],
      viewportSize[i],
      dataLength[i],
      scrollOffset[i],
      this._itemSize[i]
    ));

    const newRange = {
      start: [
        result[0].newRange.start,
        result[1].newRange.start,
      ]
      , end: [
        result[0].newRange.end,
        result[1].newRange.end,
      ]
    };

    const firstVisibleIndex = [
      result[0].firstVisibleIndex,
      result[1].firstVisibleIndex
    ];

    this._viewport.setRenderedRange(newRange);
    this._viewport.setRenderedContentOffset(this._itemSize.map((v, i) => v * newRange.start[i]));
    this._scrolledIndexChange.next(firstVisibleIndex.map(Math.floor));
  }
}


/**
 * Provider factory for `FixedSizeVirtualScrollStrategy` that simply extracts the already created
 * `FixedSizeVirtualScrollStrategy` from the given directive.
 * @param fixedSizeDir The instance of `AppFixedSizeVirtualScroll` to extract the
 *     `FixedSizeVirtualScrollStrategy` from.
 */
export function _fixedSizeVirtualScrollStrategyFactory(fixedSizeDir: AppFixedSizeGridVirtualScroll) {
  return fixedSizeDir._scrollStrategy;
}


/** A virtual scroll strategy that supports fixed-size items. */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: 'app-grid-virtual-scroll-viewport[itemSize]',
  providers: [{
    provide: VIRTUAL_SCROLL_STRATEGY,
    useFactory: _fixedSizeVirtualScrollStrategyFactory,
    deps: [forwardRef(() => AppFixedSizeGridVirtualScroll)],
  }],
})
// tslint:disable-next-line:directive-class-suffix
export class AppFixedSizeGridVirtualScroll implements OnChanges {
  /** The size of the items in the list (in pixels). */
  @Input()
  get itemSize(): number[] {
    return this._itemSize;
  }

  set itemSize(value: number[]) {
    this._itemSize = value.map(coerceNumberProperty) as number[];
  }

  /**
   * The minimum amount of buffer rendered beyond the viewport (in pixels).
   * If the amount of buffer dips below this number, more items will be rendered. Defaults to 100px.
   */
  @Input()
  get minBufferPx(): number {
    return this._minBufferPx;
  }

  set minBufferPx(value: number) {
    this._minBufferPx = coerceNumberProperty(value);
  }

  /**
   * The number of pixels worth of buffer to render for when rendering new items. Defaults to 200px.
   */
  @Input()
  get maxBufferPx(): number {
    return this._maxBufferPx;
  }

  set maxBufferPx(value: number) {
    this._maxBufferPx = coerceNumberProperty(value);
  }

  // tslint:disable-next-line:variable-name
  static ngAcceptInputType_itemSize;
  // tslint:disable-next-line:variable-name
  static ngAcceptInputType_minBufferPx;
  // tslint:disable-next-line:variable-name
  static ngAcceptInputType_maxBufferPx;

  _itemSize: number[] = [20, 20];

  _minBufferPx = 100;

  _maxBufferPx = 200;

  /** The scroll strategy used by this directive. */
  _scrollStrategy =
    new FixedSizeGridVirtualScrollStrategy(this.itemSize, this.minBufferPx, this.maxBufferPx);

  ngOnChanges() {
    this._scrollStrategy.updateItemAndBufferSize(this._itemSize, this.minBufferPx, this.maxBufferPx);
  }
}
