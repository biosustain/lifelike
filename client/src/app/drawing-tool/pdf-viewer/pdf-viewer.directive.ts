import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: '[appPdfViewer]'
})
export class PdfViewerDirective {

  constructor(
    private el: ElementRef
  ) { }

  ngAfterViewInit() {
    let dom = this.el.nativeElement as Element;

    dom = dom.getElementsByClassName('example-container mat-drawer-container')[0];

    let sidebar = dom.getElementsByTagName('mat-drawer')[0];
    let pdf = dom.getElementsByTagName('mat-drawer-content')[0];
  
    sidebar.remove();
  }
}
