import { AfterViewInit, Directive, ElementRef } from '@angular/core';

/**
 * Auto-focus the given element on load.
 */
@Directive({
  selector: '[appAutoFocus]',
})
export class AutoFocusDirective implements AfterViewInit {
  constructor(private readonly element: ElementRef) {
  }

  ngAfterViewInit() {
    this.element.nativeElement.focus();
  }
}
