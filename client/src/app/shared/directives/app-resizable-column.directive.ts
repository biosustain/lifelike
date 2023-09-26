import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appResizableColumn]',
})
export class AppResizableColumnDirective<Id extends string> {
  static readonly COLUMN_ID_ATTR = 'data-id';
  @HostBinding(`attr.${AppResizableColumnDirective.COLUMN_ID_ATTR}`)
  @Input()
  appResizableColumn: Id;
  @HostBinding(`style.resize`) resizeStyle = 'horizontal';
}
