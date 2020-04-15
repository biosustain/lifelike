/**
 * Temporarily commented out in order to allow ng build --prod
 * Un-comment once pdf-viewer is building properly
 */
// import { Directive, ElementRef, AfterViewInit } from '@angular/core';

// @Directive({
//   selector: '[appPdfViewer]'
// })
// export class PdfViewerDirective implements AfterViewInit {

//   constructor(
//     private el: ElementRef
//   ) { }

//   ngAfterViewInit() {
//     let dom = this.el.nativeElement as Element;

//     dom = dom.getElementsByClassName('example-container mat-drawer-container')[0];
//     dom.getElementsByTagName('mat-drawer')[0].remove();
//   }
// }
