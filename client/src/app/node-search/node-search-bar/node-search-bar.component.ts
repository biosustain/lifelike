import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {SearchService} from '../../search/services/search.service';
import {FTSQueryRecord} from '../../interfaces';
import {PageActions} from '../containers/node-search.component';


@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent implements OnInit, OnChanges {

  @Input() error = '';
  @Output() results = new EventEmitter<any>();
  @Input() pageActions: PageActions = {pageIndex: 1};
  paginatorActions: PageActions;
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor(private searchService: SearchService) {
  }

  ngOnInit() {
    this.paginatorActions = this.pageActions;
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propertyName in changes) {
      if (changes.hasOwnProperty(propertyName)) {
        const propertyChanges = changes[propertyName];
        const current = JSON.stringify(propertyChanges.currentValue);
        const previous = JSON.stringify(propertyChanges.previousValue);
        if (current !== previous) {
          this.paginatorActions = this.pageActions;
          this.onSubmit();
        }
      }
    }
  }

  onSubmit() {
    this.searchService.fullTextSearch(
      this.searchForm.value.searchInput,
      this.paginatorActions.pageIndex, 25).subscribe((results) => {
      this.results.emit(results.nodes as FTSQueryRecord[]);
    });
  }

}
