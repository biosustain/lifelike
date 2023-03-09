import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from "@angular/core";

import { NgbTooltip } from "@ng-bootstrap/ng-bootstrap";
import { switchMap, takeUntil, tap } from "rxjs/operators";
import { fromEvent, Subscription } from "rxjs";

import { enclosingScrollableView, isWithinScrollableView } from "../DOMutils";

/**
 * Auto-focus the given element on load.
 */
@Directive({
  selector: "[appAutoCloseTooltipOutOfView]",
})
export class AutoCloseTooltipOutOfViewDirective implements OnInit, OnDestroy {
  @Input("appAutoCloseTooltipOutOfView") tooltipRef: NgbTooltip;
  private bindingSubscription: Subscription;

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.bindingSubscription = this.tooltipRef.shown
      .pipe(
        switchMap(() => {
          const container = enclosingScrollableView(this.element.nativeElement);
          return fromEvent(container, "scroll").pipe(
            takeUntil(this.tooltipRef.hidden),
            tap(() => {
              if (
                !isWithinScrollableView(this.element.nativeElement, container)
              ) {
                this.tooltipRef?.close();
              }
            })
          );
        })
      )
      .subscribe(() => {});
  }

  ngOnDestroy() {
    this.bindingSubscription?.unsubscribe();
  }
}
