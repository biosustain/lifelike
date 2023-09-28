import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

import { distinctUntilChanged, first, map, switchMap, tap } from 'rxjs/operators';
import { BehaviorSubject, iif, Observable, of, Subscription } from 'rxjs';
import { isEqual } from 'lodash-es';

import { createResizeObservable, windowResizeObservable } from 'app/shared/rxjs/resize-observable';

interface Viewport {
  width: number;
  height: number;
  x: number;
  y: number;
}

@Directive({
  selector: '[appConstrainToViewport]',
})
export class ConstrainToViewportDirective implements AfterViewInit, OnDestroy, OnChanges {
  constructor(private element: ElementRef, private ngZone: NgZone) {}

  private readonly _margin$ = new BehaviorSubject<number>(30);
  private readonly _viewport$$ = new BehaviorSubject<Observable<Viewport>>(
    windowResizeObservable.pipe(map((size) => ({ x: 0, y: 0, ...size })))
  );
  private readonly _viewport$ = this._viewport$$.pipe(switchMap((viewport$) => viewport$));
  private readonly _resize$$ = new BehaviorSubject(
    createResizeObservable(this.element.nativeElement, { leading: true })
  );
  private readonly _resize$ = this._resize$$.pipe(switchMap((resize$) => resize$));
  @Input() resize$: Observable<DOMRectReadOnly>;
  @Input() margin: Observable<number>;
  @Input('appConstrainToViewport') viewport$;
  @HostBinding('style.maxWidth.px') maxWidth;
  @HostBinding('style.maxHeight.px') maxHeight;

  readonly updateSize$ = this._viewport$.pipe(
    switchMap((viewport) => {
      const { offsetWidth, offsetHeight } = this.element.nativeElement;
      return iif(
        // if was displayed
        () => offsetWidth + offsetHeight > 0,
        // continiue
        of({}),
        // if not wait till it resizes
        this._resize$.pipe(first())
      ).pipe(
        map(() => {
          const { x, y } = this.element.nativeElement.getBoundingClientRect();
          return {
            maxWidth: viewport.width - (x - viewport.x),
            maxHeight: viewport.height - (y - viewport.y),
          };
        })
      );
    }),
    distinctUntilChanged(isEqual),
    switchMap(({ maxWidth, maxHeight }) =>
      this._margin$.pipe(
        tap((margin) => {
          this.ngZone.run(() => {
            this.maxWidth = maxWidth - margin;
            this.maxHeight = maxHeight - margin;
          });
        })
      )
    )
  );

  updateSubscription: Subscription;

  ngOnChanges({ margin, viewport$, resize$ }: SimpleChanges) {
    if (margin) {
      this._margin$.next(margin.currentValue);
    }
    if (viewport$) {
      this._viewport$$.next(viewport$.currentValue);
    }
    if (resize$) {
      this._resize$$.next(resize$.currentValue);
    }
  }

  ngAfterViewInit() {
    this.updateSubscription = this.updateSize$.subscribe(() => {});
  }

  ngOnDestroy() {
    this.updateSubscription?.unsubscribe();
  }
}
