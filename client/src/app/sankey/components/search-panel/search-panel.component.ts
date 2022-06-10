import { Component, ViewEncapsulation, ViewChildren, AfterViewInit, ViewChild } from '@angular/core';

import { Observable } from 'rxjs';
import { groupBy, defer, sortBy } from 'lodash-es';
import { map } from 'rxjs/operators';
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap';

import { SankeySearchService } from '../../services/search.service';
import { ControllerService } from '../../services/controller.service';
import { SearchResultComponent } from './search-result/search-result.component';

@Component({
  selector: 'app-sankey-search-panel',
  templateUrl: './search-panel.component.html',
  styleUrls: ['./search-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySearchPanelComponent implements AfterViewInit {
  constructor(
    private search: SankeySearchService,
    private common: ControllerService
  ) {
  }

  term$ = this.search.term$;
  searchTokens$ = this.search.searchTokens$;
  searchFocus$ = this.search.searchFocus$;
  resultsCount$ = this.search.resultsCount$;
  done$ = this.search.done$;
  networkTraceIdx$ = this.common.networkTraceIdx$;

  groupedMatches$ = this.search.preprocessedMatches$.pipe(
    map(matches =>
      // grouping by network trace idx preserves priority order
      groupBy(
        // matches are sorted by their priority
        sortBy(
          matches,
          'priority'
        ),
        'networkTraceIdx'
      )
    )
  );

  @ViewChild(NgbAccordion) accordion: NgbAccordion;
  @ViewChildren(SearchResultComponent) listItems;

  setFocusIdx(idx: number) {
    return this.search.setFocusIdx(idx).toPromise();
  }

  ngAfterViewInit() {
    this.search.searchFocus$.subscribe(({networkTraceIdx, idx}) => {
      this.accordion.expand(String(networkTraceIdx));
      defer(() => this.scrollIntoView(idx));
    });
  }

  networkTraceIdxToName(networkTraceIdx: number): Observable<string> {
    return this.common.networkTraces$.pipe(
      map(networkTraces => networkTraces[networkTraceIdx].name)
    );
  }

  scrollIntoView(focusedIdx): void {
    if (focusedIdx >= 0 && this.listItems) {
      // allow casting matches "0" == 0 => true
      // tslint:disable-next-line:triple-equals
      const itemNode = this.listItems.toArray().find(({result: {idx}}) => focusedIdx == idx);
      if (itemNode) {
        const {element: {nativeElement}} = itemNode;
        if (nativeElement.scrollIntoViewIfNeeded) {
          nativeElement.scrollIntoViewIfNeeded();
        } else {
          nativeElement.scrollIntoView(true);
        }
      }
    }
  }
}
