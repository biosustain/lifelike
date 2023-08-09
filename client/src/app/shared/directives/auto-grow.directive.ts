import {
  Directive,
  HostListener,
  HostBinding,
  Input,
  ElementRef,
  OnInit,
  OnDestroy,
} from '@angular/core';

import { Observable, BehaviorSubject, Subject, of } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

@Directive({
  selector: 'input[appAutoGrow]',
})
export class AutoGrowDirective implements OnInit, OnDestroy {
  constructor(private el: ElementRef) {}

  // for compatibility with global styling (e.g. bootstrap) avoiding to change box-sizing
  @Input() paddingBorderAdjustment = 'calc( 0.65rem + 1px )';
  @Input() type: string;
  metaRecalculate = new BehaviorSubject(of());
  @Input() set recalculate(recalculateObservable: Observable<any>) {
    this.metaRecalculate.next(recalculateObservable);
  }
  destroyed$ = new Subject();

  @HostBinding('style.width') width: string;

  ngOnInit() {
    this.metaRecalculate
      .pipe(
        switchMap((recalculateObservable) => recalculateObservable),
        takeUntil(this.destroyed$)
      )
      .subscribe(() => this.adjustWidth(this.el.nativeElement.value.length));
  }

  ngOnDestroy() {
    this.destroyed$.next();
  }

  @HostListener('input', ['$event.target.value.length'])
  adjustWidth(length: number) {
    // +2 for arrows
    const contentWidth = length + (this.type === 'number' ? 2 : 0) + 'ch';
    this.width = `calc(${contentWidth} + ${this.paddingBorderAdjustment})`;
  }
}
