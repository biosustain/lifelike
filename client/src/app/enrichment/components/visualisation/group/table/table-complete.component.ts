import { DecimalPipe } from '@angular/common';
import { Component, QueryList, ViewChildren, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Observable } from 'rxjs';

import { DataService } from '../../../../../shared/services/table.service';
import { SortableTableHeaderDirective, SortEvent } from '../../../../../shared/directives/table-sortable-header.directive';
import { EnrichWithGOTermsResult } from '../../../../services/enrichment-visualisation.service';


@Component({
  selector: 'app-table-complete',
  templateUrl: './table-complete.component.html',
  styleUrls: ['./table-complete.component.scss'],
  providers: [DataService, DecimalPipe]
})
export class TableCompleteComponent implements OnChanges {
  data$: Observable<EnrichWithGOTermsResult[]>;
  total$: Observable<number>;
  @Input() data: EnrichWithGOTermsResult[];
  @Input() itemsPerPage: number;
  @Input() showMore = true;

  @ViewChildren(SortableTableHeaderDirective) headers: QueryList<SortableTableHeaderDirective>;

  constructor(public service: DataService) {
    this.data$ = service.data$;
    this.total$ = service.total$;
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
    if (data || showMore) {
      this.service.inputData = this.data;
    }
  }

  significanceIndicator(qValue) {
    return (qValue >= .1 ? '' :
      qValue >= 0.05 ? '.' :
        qValue >= 0.01 ? '*' :
          qValue >= 0.001 ? '**' :
            '***');
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

