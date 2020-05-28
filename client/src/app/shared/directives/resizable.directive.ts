import { Directive, ElementRef, Input } from '@angular/core';
import * as $ from 'jquery';
import 'jqueryui';
import { isNullOrUndefined } from 'util';

@Directive({
  selector: '[appResizable]'
})
export class ResizableDirective {
  @Input() handles = 'n,w,s,e';
  @Input() minHeight = 52;

  constructor(el: ElementRef) {

    setTimeout(() => {
      if (isNullOrUndefined(
        el.nativeElement
      )) {
        return;
      }

      $(`#${el.nativeElement.id}`).resizable({
        handles: this.handles,
        maxWidth: 500,
        minWidth: 256,
        maxHeight: 500,
        minHeight: this.minHeight
      });
    }, 200);
  }

}
