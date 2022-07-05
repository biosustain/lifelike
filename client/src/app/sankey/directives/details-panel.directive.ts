import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appSankeyDetailsPanel]'
})
export class SankeyDetailsPanelDirective {
  constructor(public viewContainerRef: ViewContainerRef) {}
}
