import { Directive, HostBinding } from '@angular/core';

import { makeid } from '../utils/identifiers';

@Directive({
  selector: '[appHasPlaceholder]'
})
export class HasPlaceholderDirective {
  @HostBinding('class.placeholder-slot') placeholderSlotClass = true;
}
