import { DecimalPipe } from '@angular/common';
import { Component, QueryList, ViewChildren, Input, OnInit, OnChanges } from '@angular/core';
import { Observable } from 'rxjs';

import { Country } from './country';
import { DataService } from './country.service';
import { NgbdSortableHeader, SortEvent } from './sortable.directive';


@Component({
  selector: 'app-table-complete',
  templateUrl: './table-complete.html',
  providers: [DataService, DecimalPipe]
})
export class NgbdTableComplete implements OnInit, OnChanges {
  data$: Observable<Country[]>;
  total$: Observable<number>;
  @Input() data;
  @Input() itemsPerPage;
  @Input() showControls;

  @ViewChildren(NgbdSortableHeader) headers: QueryList<NgbdSortableHeader>;

  constructor(public service: DataService) {
    this.data$ = service.data$;
    this.total$ = service.total$;
  }

  ngOnInit() {
    if (this.itemsPerPage) {
      this.service.pageSize = this.itemsPerPage;
    }
    this.service.inputData = this.data;
  }
  ngOnChanges() {
    if (this.itemsPerPage) {
      this.service.pageSize = this.itemsPerPage;
    }
    this.service.inputData = this.data;
  }

  onSort({column, direction}: SortEvent) {
    // resetting other headers
    this.headers.forEach(header => {
      if (header.sortable !== column) {
        header.direction = '';
      }
    });

    this.service.sortColumn = column;
    this.service.sortDirection = direction;
  }
}
