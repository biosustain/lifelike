import { Directive, HostBinding } from '@angular/core';

import { makeid } from '../utils/identifiers';

@Directive({
  selector: '[appUid]',
  exportAs: 'uid',
})
export class UidDirective {
  @HostBinding('id') uid = `uid-${makeid()}`;
}
