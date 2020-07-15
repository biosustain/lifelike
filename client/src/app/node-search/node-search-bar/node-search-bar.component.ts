import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormControl} from '@angular/forms';
import {SearchService} from 'app/search/services/search.service';
import {FTSQueryRecord} from 'app/interfaces';

@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent implements OnChanges {

  @Input() domainsFilter = '';
  @Input() typesFilter = '';
  filter = 'labels(node)';
  @Output() results = new EventEmitter<any>();
  searchInput = new FormControl('');

  constructor(private searchService: SearchService) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      if (changes.hasOwnProperty(propertyName)) {
        const propertyChanges = changes[propertyName];
        const current = JSON.stringify(propertyChanges.currentValue);
        const previous = JSON.stringify(propertyChanges.previousValue);
        if (current !== previous) {
          this.filter = this.filterComposer();
          this.onSubmit();
        }
      }
    }
  }

  private filterComposer() {
    const filters = [this.domainsFilter, this.typesFilter];
    const isEmpty = (currentValue) => currentValue === '';
    if (filters.every(isEmpty)) {
      return 'labels(n)';
    }
    const hasContent = (currentValue) => currentValue !== '';
    const appliedFilters = filters.filter(hasContent);
    let filterString = '';
    appliedFilters.forEach((filter, index) => {
      if (appliedFilters.length - 1 === index) {
        filterString += filter;
        return;
       }
      filterString += filter + ' AND ';
    });
    return filterString;
  }

  onSubmit() {
    const text: string = this.searchInput.value;

    this.searchService.simpleFullTextSearch(text, 1, 100, this.filter).
      subscribe((results) => {
        this.results.emit(results.nodes as FTSQueryRecord[]);
      });
  }
}
