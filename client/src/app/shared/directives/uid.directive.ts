import { Directive, HostBinding } from '@angular/core';
let counter = 0;

@Directive({
  selector: '[appUid]',
  exportAs: 'uid'
})
export class UidDirective {
  @HostBinding('id') uid = `uid-${counter++}`;
}
