import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { map, switchMap, takeUntil, takeWhile, tap } from 'rxjs/operators';
import { fromEvent, Subscription } from 'rxjs';

import { enclosingScrollableView, isWithinScrollableView } from '../../../utils/dom';

/**
 * Auto-focus the given element on load.
 */
@Directive({
  selector: '[appAutoCloseTooltipOutOfView]',
})
export class AutoCloseTooltipOutOfViewDirective implements OnInit, OnDestroy {
  @Input('appAutoCloseTooltipOutOfView') tooltipRef: NgbTooltip;
  private bindingSubscription: Subscription;

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.bindingSubscription = this.tooltipRef.shown
      .pipe(
        map(() => enclosingScrollableView(this.element.nativeElement)),
        takeWhile((container) => Boolean(container)),
        switchMap((container) =>
          fromEvent(container, 'scroll').pipe(
            takeUntil(this.tooltipRef.hidden),
            tap(() => {
              if (!isWithinScrollableView(this.element.nativeElement, container)) {
                this.tooltipRef?.close();
              }
            })
          )
        )
      )
      .subscribe(() => {});
  }

  ngOnDestroy() {
    this.bindingSubscription?.unsubscribe();
  }
}
