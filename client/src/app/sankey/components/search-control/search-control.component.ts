import { Component } from '@angular/core';

import { SankeySearchService } from '../../services/search.service';

@Component({
  selector: 'app-sankey-search-control',
  templateUrl: './search-control.component.html'
})
export class SankeySearchControlComponent {
  constructor(
    public search: SankeySearchService
  ) {
  }

  term$ = this.search.term$;
  focusIdx$ = this.search.focusIdx$;
  resultsCount$ = this.search.resultsCount$;
  done$ = this.search.done$;

  previous() {
    this.search.previous();
  }

  next() {
    this.search.next();
  }

}
