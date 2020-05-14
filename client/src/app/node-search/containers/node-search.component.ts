import {Component} from '@angular/core';

@Component({
  selector: 'app-search-collection-page',
  template: `
    <app-node-search-bar></app-node-search-bar>
    <app-node-result-list></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  constructor() {
  }
}
