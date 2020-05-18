import {Component} from '@angular/core';

export interface Nodes {
  position: number;
  database: string;
  type: string;
  name: string;
}

@Component({
  selector: 'app-search-collection-page',
  template: `
    <app-node-search-bar
      (results)="getResults($event)"
    ></app-node-search-bar>
    <app-node-result-list
      [nodes]="dataSource"
    ></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  dataSource: Nodes[] = [];

  constructor() {
  }

  getResults(results) {
    this.dataSource = results.map((data, index) => {
      return {
        position: index,
        name: data.node.displayName,
        type: data.node.label,
        database: data.node.data.id.split(':')[0]
      };
    });
  }
}
