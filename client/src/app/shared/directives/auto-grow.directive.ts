import { Directive, HostListener, HostBinding, Input, ElementRef, OnInit } from '@angular/core';

@Directive({
  selector: 'input[appAutoGrow]'
})
export class AutoGrowDirective implements OnInit {
  constructor(private el: ElementRef) {
  }

  // for compatibility with global styling (e.g. bootstrap) avoiding to change box-sizing
  @Input() paddingBorderAdjustment = 'calc( 0.65rem + 1px )';
  @Input() type: string;

  @HostBinding('style.width') width: string;

  ngOnInit() {
    this.adjustWidth(this.el.nativeElement.value.length);
  }

  @HostListener('input', ['$event.target.value.length'])
  adjustWidth(length: number) {
    // +2 for arrows
    const contentWidth = length + (this.type === 'number' ? 2 : 0) + 'ch';
    this.width = `calc(${contentWidth} + ${this.paddingBorderAdjustment})`;
  }
}
