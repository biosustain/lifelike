import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {SearchService} from '../../search/services/search.service';
import {FTSQueryRecord} from '../../interfaces';


@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent implements OnInit {

  @Input() error = '';
  @Output() results = new EventEmitter<any>();
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor(private searchService: SearchService) {
  }

  ngOnInit() {
  }

  onSubmit() {
    this.searchService.simpleFullTextSearch(
      this.searchForm.value.searchInput,
      1, 100, 'labels(node)').subscribe((results) => {
      this.results.emit(results.nodes as FTSQueryRecord[]);
    });
  }

}
