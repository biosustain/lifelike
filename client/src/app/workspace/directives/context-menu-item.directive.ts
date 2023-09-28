import { Directive, HostBinding, HostListener } from '@angular/core';

@Directive({
  selector: '[appContextMenuItem]',
})
export class ContextMenuItemDirective {
  @HostBinding('class.dropdown-item') _dropdownItemClass = true;
  @HostBinding('attr.href') _dropdownItemHref = '#';

  @HostListener('click', ['$event']) click(clickEvent: Event) {
    clickEvent.preventDefault();
  }
}
