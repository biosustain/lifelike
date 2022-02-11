import { Component, ViewEncapsulation, ViewChildren, ElementRef } from '@angular/core';

import { combineLatest } from 'rxjs';

import { SankeySearchService } from '../../services/search.service';

@Component({
  selector: 'app-sankey-search-panel',
  templateUrl: './search-panel.component.html',
  styleUrls: ['./search-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySearchPanelComponent {
  constructor(
    private search: SankeySearchService
  ) {
    combineLatest([
      this.search.preprocessedMatches$,
      this.search.focusIdx$
    ]).subscribe(([
                    entities,
                    focusedIdx
                  ]) => {
        this.scrollIntoView(focusedIdx);
      }
    );
  }

  term$ = this.search.term$;
  searchTokens$ = this.search.searchTokens$;
  focusIdx$ = this.search.focusIdx$;
  preprocessedMatches$ = this.search.preprocessedMatches$;
  resultsCount$ = this.search.resultsCount$;
  done$ = this.search.done$;

  @ViewChildren('item', {read: ElementRef}) listItems;

  scrollIntoView(focusedIdx): void {
    if (focusedIdx >= 0 && this.listItems) {
      const itemNode = this.listItems.toArray()[focusedIdx];
      if (itemNode) {
        const {nativeElement} = itemNode;
        if (nativeElement.scrollIntoViewIfNeeded) {
          nativeElement.scrollIntoViewIfNeeded();
        } else {
          nativeElement.scrollIntoView(true);
        }
      }
    }
  }
}
