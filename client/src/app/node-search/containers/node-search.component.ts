import {Component} from '@angular/core';

export interface Nodes {
  position: number;
  domain: string;
  type: string;
  name: string;
}

export interface PageActions {
  pageIndex: number;
}

@Component({
  selector: 'app-search-collection-page',
  template: `
    <app-node-search-bar
      (results)="getResults($event)"
      [pageActions]="pageActions"
    ></app-node-search-bar>
    <app-node-result-list
      [nodes]="dataSource"
      (page)="paginatorEvent($event)"
    ></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  dataSource: Nodes[] = [];
  pageActions: PageActions = {pageIndex: 1};


  constructor() {
  }

  getResults(results) {
    this.dataSource = results.map((data, index) => {
      return {
        position: index + 1,
        name: data.node.displayName,
        type: data.node.label,
        domain: this.getDomain(data.node.subLabels)
      };
    });
  }

  paginatorEvent(page) {
    if (page) {
      this.pageActions = {pageIndex: page.pageIndex};
    }
  }

  getDomain(subLabels: string[]) {
    return subLabels.find(element  => element.match(/^db_*/))
      .split('_')[1];
  }
}
