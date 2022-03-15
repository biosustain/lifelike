import { Input, OnDestroy, OnChanges, SimpleChanges, OnInit, Directive } from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Subscription, BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { switchMap, tap, takeUntil } from 'rxjs/operators';

import { createScrollObservable } from '../rxjs/scroll-observable';

/**
 * Show tooltip only if text offloads
 * Does not work in combination with ngbTooltip
 */
@Directive({
  selector: '[appTextTruncateToTooltip]:not([ngbTooltip])',
})
export class TextTruncateToTooltipDirective extends NgbTooltip implements OnDestroy, OnChanges, OnInit {
  @Input('appTextTruncateToTooltip') set appTextTruncateToTooltip(title) {
    this.ngbTooltip = title;
  }

  @Input() container = 'body';

  /**
   * To improve performence scroll observable can be passed.
   * By default this component will create observer on itself and 'document'.
   * If there are multiple sibling components it is more performant to
   * create it in parent.
   * Pn the other hand closing tooltip on scroll behaviour can be turned off completely
   * bu passing null|undefined|rxjs.EMPTY to this input.
   */
  @Input() scroll$: Observable<any>;

  // Nest observable so we can maintain subscription even if input changes
  // createScrollObservable actually creates new observable but inits it on subscription
  // @ts-ignore - we are using private variable of parent (didn't found the way around it)
  scroll$$ = new BehaviorSubject<Observable<any>>(createScrollObservable(this._elementRef.nativeElement, document));

  // Flattern nested observable
  _scroll$ = this.scroll$$.pipe(switchMap(scroll$ => scroll$));

  scrollSubscription: Subscription;

  set disableTooltip(disable) {
    // Added for compability with super class
  }

  get disableTooltip() {
    // @ts-ignore - we are using private variable of parent (didn't found the way around it)
    const {scrollWidth, offsetWidth} = this._elementRef.nativeElement;
    return scrollWidth <= offsetWidth;
  }

  ngOnInit() {
    // each time tooltip opens listen to scroll events and close tooltip if scroll starts
    this.scrollSubscription = this.shown.pipe(
      switchMap(() => this._scroll$.pipe(
        takeUntil(this.hidden),
        tap(() => this.close())
      )),
    ).subscribe();

    super.ngOnInit();
  }

  ngOnChanges({scroll$}: SimpleChanges) {
    if (scroll$) {
      this.scroll$$.next(scroll$.currentValue ?? EMPTY);
    }
  }

  ngOnDestroy() {
    if (this.scrollSubscription) {
      this.scrollSubscription.unsubscribe();
    }
  }
}
