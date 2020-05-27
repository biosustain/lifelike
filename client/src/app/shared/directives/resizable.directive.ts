import { Directive, ElementRef } from '@angular/core';
import * as $ from 'jquery';
import 'jqueryui';

@Directive({
  selector: '[appResizable]'
})
export class ResizableDirective {

  constructor(el: ElementRef) {
    el.nativeElement.style.backgroundColor = 'yellow';

    $('#info-panel').resizable({
      handles: 'n,w,s,e',
      minWidth: 256,
      maxWidth: 400
    });
    console.log(el.nativeElement.id);
  }

}
