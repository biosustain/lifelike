import { Directive, ElementRef, Renderer2, Input, AfterViewInit } from '@angular/core';

/**
 * Show tooltip only if text offloads
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '.text-truncate'
})
export class TextTruncateDirective implements AfterViewInit {
  constructor(
    private readonly renderer: Renderer2,
    private readonly element: ElementRef
  ) {
  }

  @Input() title: string;

  ngAfterViewInit() {
    const {nativeElement} = this.element;
    if (nativeElement.scrollWidth > nativeElement.offsetWidth) {
      this.renderer.setAttribute(nativeElement, 'title', this.title || nativeElement.innerText);
    } else {
      this.renderer.removeAttribute(nativeElement, 'title');
    }
  }
}
