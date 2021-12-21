import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appSankey]'
})
export class SankeyDirective {
  constructor(public viewContainerRef: ViewContainerRef) {}
}
