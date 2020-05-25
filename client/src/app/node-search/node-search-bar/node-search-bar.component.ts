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
export class NodeSearchBarComponent implements OnInit {

  @Input() error = '';
  @Output() results = new EventEmitter<any>();
  paginatorActions: PageActions;
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor(private searchService: SearchService) {
  }

  ngOnInit() {
  }

  onSubmit() {
    this.searchService.fullTextSearch(
      this.searchForm.value.searchInput,
      1, 100).subscribe((results) => {
      this.results.emit(results.nodes as FTSQueryRecord[]);
    });
  }

}
