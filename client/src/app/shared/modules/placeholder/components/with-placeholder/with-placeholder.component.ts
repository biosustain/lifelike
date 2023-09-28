import { Component, HostBinding } from '@angular/core';

@Component({
  selector: 'app-with-placeholder',
  template: '<ng-content></ng-content>',
})
export class WithPlaceholderComponent {
  @HostBinding('class.placeholder-slot') placeholderSlotClass = true;
}
