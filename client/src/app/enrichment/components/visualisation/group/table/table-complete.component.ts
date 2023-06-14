import { DecimalPipe } from '@angular/common';
import { Component, QueryList, ViewChildren, Input, OnChanges, SimpleChanges } from '@angular/core';

import { Observable } from 'rxjs';

import { DataService } from 'app/shared/services/table.service';
import {
  SortableTableHeaderDirective,
  SortEvent,
  SortDirection,
} from 'app/shared/directives/table-sortable-header.directive';
import {
  EnrichmentVisualisationService,
  EnrichWithGOTermsResult,
} from 'app/enrichment/services/enrichment-visualisation.service';
import { ExtendedMap, ExtendedWeakMap } from '../../../../../shared/utils/types';
import { shareReplay } from 'rxjs/operators';

@Component({
  selector: 'app-table-complete',
  templateUrl: './table-complete.component.html',
  styleUrls: ['./table-complete.component.scss'],
  providers: [DataService, DecimalPipe],
})
export class TableCompleteComponent implements OnChanges {
  data$: Observable<EnrichWithGOTermsResult[]>;
  total$: Observable<number>;
  @Input() data: EnrichWithGOTermsResult[];
  @Input() itemsPerPage: number;
  @Input() showMore = true;
  @Input() show = true;

  @ViewChildren(SortableTableHeaderDirective) headers: QueryList<SortableTableHeaderDirective>;

  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    public service: DataService,
  ) {
    this.data$ = service.data$;
    this.total$ = service.total$;
  }

  termContextExplanations = new ExtendedMap();

  getTermContextExplanation(term) {
    return this.termContextExplanations.getSetLazily(
      term,
      key => this.enrichmentService.enrichWithContext(key).pipe(
        shareReplay(1)
      )
    );
  }

  ngOnChanges({ show, showMore, data }: SimpleChanges) {
    if (showMore) {
      if (!showMore.currentValue) {
        if (!showMore.firstChange) {
          this.service.patch({
            page: 1,
            searchTerm: '',
            pageSize: 5,
          });
        }
      } else {
        this.service.pageSize = 15;
      }
    }
    if (this.show && (show || data || showMore)) {
      this.service.inputData = this.data;
    }
  }

  significanceIndicator(qValue) {
    return qValue >= 0.1
      ? ''
      : qValue >= 0.05
      ? '.'
      : qValue >= 0.01
      ? '*'
      : qValue >= 0.001
      ? '**'
      : '***';
  }

  onSort({ id, direction }: SortEvent) {
    // resetting other headers - we could for instance accumulate sort instead
    this.headers.forEach((header) => {
      if (header.id !== id) {
        header.direction = SortDirection.none;
      }
    });

    this.service.sortColumn = id;
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
