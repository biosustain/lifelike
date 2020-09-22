import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss']
})
export class GenericTableComponent {
  HEADER: TableHeader[][];

  // Number of columns can be inferred from the headers
  numColumns: number[];
  entries: string[][];

  constructor() {}

  // Probably don't need setters for all of these
  @Input()
  set header(header: TableHeader[][]) {
    this.HEADER = header;
  }
  @Input()
  set columns(num: number) {
    this.numColumns = new Array(num);
  }
  @Input()
  set rows(entries: string[][]) {
    this.entries = entries;
  }
}

// Should probably be an interface rather than a class
export class TableHeader {
  name: string;
  span: string;

  constructor(name: string, span: string) {
    this.name = name;
    this.span = span;
  }
}
