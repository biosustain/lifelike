import { Directive, HostBinding, Input } from '@angular/core';

import { makeid } from '../utils/identifiers';

@Directive({
  selector: '[appShowPlaceholders]'
})
export class HasPlaceholderDirective {
  @HostBinding('class.show-placeholders') @Input() appShowPlaceholders = true;
}
