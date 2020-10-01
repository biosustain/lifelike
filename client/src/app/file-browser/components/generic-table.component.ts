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

  constructor() {}

  // Probably don't need setters for all of these
  @Input()
  set header(header: TableHeader[][]) {
    this.HEADER = header;
    const num = Math.max.apply(null, header.map(x => x.reduce((a,b) => a + parseInt(b.span), 0)))
    this.numColumns = new Array(num)
  }
  @Input() entries: TableCell[][];
}

export interface TableCell {
  text: string;
  singleLink?: TableLink;
  multiLink?: TableLink[];
}

export interface TableLink {
  link: string;
  linkText: string
}

// Should probably be an interface rather than a class
export interface TableHeader {
  name: string;
  span: string;
}
