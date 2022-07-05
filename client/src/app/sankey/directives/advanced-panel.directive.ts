import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appSankeyAdvancedPanel]'
})
export class SankeyAdvancedPanelDirective {
  constructor(public viewContainerRef: ViewContainerRef) {}
}
