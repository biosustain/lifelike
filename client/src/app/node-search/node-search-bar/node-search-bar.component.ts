import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {SearchService} from '../../search/services/search.service';
import {FTSQueryRecord} from '../../interfaces';


@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent implements OnInit, OnChanges {

  @Input() domainsFilter = '';
  @Input() typesFilter = '';
  filter = 'labels(node)';
  @Output() results = new EventEmitter<any>();
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor(private searchService: SearchService) {
  }

  ngOnInit() {
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
    this.searchService.simpleFullTextSearch(
      this.searchForm.value.searchInput,
      1, 100, this.filter).subscribe((results) => {
      this.results.emit(results.nodes as FTSQueryRecord[]);
    });
  }
}
