import { Directive, EventEmitter, Input, Output, HostBinding, HostListener } from '@angular/core';

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
  none = 'none'
}

export type SortDirectionType = keyof typeof SortDirection | false | 0 | '' | null | undefined;

const rotate: { [key: string]: SortDirectionType } = {
  [SortDirection.asc]: SortDirection.desc,
  [SortDirection.desc]: SortDirection.none,
  [SortDirection.none]: SortDirection.asc
};

export interface SortEvent {
  id: any;
  direction: SortDirectionType;
}

@Directive({
  selector: 'th[appSortable]',
  exportAs: 'appSortable'
})
export class SortableTableHeaderDirective {
  @Input() @Input('appSortable') id: any;
  @HostBinding('attr.data-sort') @Input() public direction: SortDirectionType = SortDirection.none;

  @Output() sort = new EventEmitter<SortEvent>();

  @HostListener('click') rotate() {
    this.direction = rotate[this.direction || SortDirection.none];
    this.sort.emit({...this});
  }
}
