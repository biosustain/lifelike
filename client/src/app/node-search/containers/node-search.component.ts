import {Component} from '@angular/core';
import {FTSQueryRecord} from '../../interfaces';
import {Observable} from 'rxjs';

@Component({
  selector: 'app-search-collection-page',
  template: `
    <app-node-search-bar
      (results)="getResults($event)"
    ></app-node-search-bar>
    <app-node-result-list></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  results: Observable<FTSQueryRecord[]>;

  constructor() {
  }

  getResults(results) {
    this.results = results;
    console.log(this.results)
  }
}
