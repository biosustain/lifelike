import { ElementRef, Directive } from '@angular/core';

import { createResizeObservable } from '../rxjs/resize-observable';
import { createScrollObservable } from '../rxjs/scroll-observable';

/**
 * Get resize observable of element
 * IMPORTANT!: This does not work on inline elements (display: inline)
 */
@Directive({
  selector: '[appElementObserver]',
  exportAs: 'appElementObserver',
})
export class ElementObserverDirective {
  constructor(protected _elementRef: ElementRef<HTMLElement>) {}

  readonly size$ = createResizeObservable(this._elementRef.nativeElement, { leading: true });
  readonly scroll$ = createScrollObservable(this._elementRef.nativeElement);
}
