import {Component, Input, OnInit} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';

@Component({
  selector: 'app-node-search-bar',
  templateUrl: './node-search-bar.component.html',
  styleUrls: ['./node-search-bar.component.scss']
})
export class NodeSearchBarComponent implements OnInit {

  @Input() query = '';
  @Input() error = '';
  searchForm = new FormGroup({
    searchInput: new FormControl(''),
  });

  constructor() {
  }

  ngOnInit() {
  }

  onSubmit() {
  }

}
