import { Directive, EventEmitter, Input, Output, HostBinding, HostListener } from '@angular/core';

import { pick } from 'lodash-es';

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

export interface SortEvent<ID = string> {
  id: ID;
  direction: SortDirectionType;
}

@Directive({
  selector: 'th[appSortable]',
  exportAs: 'appSortable'
})
export class SortableTableHeaderDirective<ID = string> {
  // tslint:disable-next-line:no-input-rename
  @Input('appSortable') id: ID;
  @HostBinding('attr.data-sort') @Input() public direction: SortDirectionType = SortDirection.none;

  @Output() sort = new EventEmitter<SortEvent<ID>>();

  @HostListener('click') rotate() {
    this.direction = rotate[this.direction || SortDirection.none];
    this.sort.emit(pick(this, 'id', 'direction'));
  }
}
