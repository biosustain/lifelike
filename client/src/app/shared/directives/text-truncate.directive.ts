import {
  Directive,
  ElementRef,
  Renderer2,
  Input,
  AfterViewInit,
  Injector,
  ComponentFactoryResolver,
  ViewContainerRef,
  NgZone,
  ChangeDetectorRef,
  ApplicationRef
} from '@angular/core';

import { NgbTooltip, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';

/**
 * Show tooltip only if text offloads
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '.text-truncate'
})
// @ts-ignore
export class TextTruncateDirective extends NgbTooltip implements AfterViewInit {
  constructor(
    protected _elementRef: ElementRef<HTMLElement>,
    protected _renderer: Renderer2,
    protected injector: Injector,
    protected componentFactoryResolver: ComponentFactoryResolver,
    protected viewContainerRef: ViewContainerRef,
    protected config: NgbTooltipConfig,
    protected _ngZone: NgZone,
    protected _changeDetector: ChangeDetectorRef,
    protected applicationRef: ApplicationRef
  ) {
    super(
      _elementRef,
      _renderer,
      injector,
      componentFactoryResolver,
      viewContainerRef,
      config,
      _ngZone,
      document,
      _changeDetector,
      applicationRef
    );
  }

  @Input() title: string;

  ngAfterViewInit() {
    const {nativeElement: {scrollWidth, offsetWidth}} = this._elementRef;
    this.ngbTooltip = this.title || this._elementRef.nativeElement.innerText;
    this.disableTooltip = scrollWidth <= offsetWidth;
    this.container = 'body';
  }
}
