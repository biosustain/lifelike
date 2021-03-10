import { DecimalPipe } from '@angular/common';
import { Component, QueryList, ViewChildren, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';

import { DataService } from '../../../../../shared/services/table.service';
import { SortableTableHeaderDirective, SortEvent } from '../../../../../shared/directives/table-sortable-header.directive';


@Component({
  selector: 'app-table-complete',
  templateUrl: './table-complete.component.html',
  styleUrls: ['./table-complete.component.scss'],
  providers: [DataService, DecimalPipe]
})
export class TableCompleteComponent implements OnInit, OnChanges {
  data$: Observable<any[]>;
  total$: Observable<number>;
  @Input() data;
  @Input() itemsPerPage;
  @Input() showMore = true;

  @ViewChildren(SortableTableHeaderDirective) headers: QueryList<SortableTableHeaderDirective>;

  constructor(public service: DataService) {
    this.data$ = service.data$;
    this.total$ = service.total$;
  }

  ngOnInit() {
    this.service.pageSize = this.showMore ? 15 : 5;
    this.service.inputData = this.data;
  }

  ngOnChanges({showMore, data}: SimpleChanges) {
    if (!showMore.currentValue) {
      if (!showMore.firstChange) {
        this.service.patch({
          page: 1,
          searchTerm: '',
          pageSize: 5
        });
      }
    } else {
      this.service.pageSize = 15;
    }
    if (data) {
      this.service.inputData = this.data;
    }
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

export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}

