import {Component, SecurityContext} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';

export interface Nodes {
  link: string;
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
    ></app-node-search-bar>
    <app-node-result-list
      [nodes]="dataSource"
    ></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  DOMAINS_URL = {
    CHEBI: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
    MESH: 'https://www.ncbi.nlm.nih.gov/mesh/?term=',
    Text: 'https://pubmed.ncbi.nlm.nih.gov/',
    NCBI_Gene: 'https://www.ncbi.nlm.nih.gov/gene/',
    NCBI_Taxonomy: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id='
  };
  dataSource: Nodes[] = [];
  pageActions: PageActions = {pageIndex: 1};


  constructor(private sanitizer: DomSanitizer) {
  }

  getResults(results) {
    this.dataSource = results.map((data) => {
      return {
        link: this.getLink(data),
        name: this.getName(data),
        type: this.getType(data.node.subLabels),
        domain: this.getDomain(data.node.subLabels)
      };
    });
  }


  getDomain(subLabels: string[]) {
    return subLabels.find(element => element.match(/^db_*/))
      .split('_')[1];
  }

  getType(subLabels: string[]) {
    const type = subLabels.find(element => !element.match(/^db_*/));
    return type === 'TopicalDescriptor' ? 'Disease' : type;
  }

  getLink(data) {
    const domain = this.getDomain(data.node.subLabels);
    const type = this.getType(data.node.subLabels);
    if (domain === 'NCBI' && type === 'Gene') {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain + '_' + type] +
        data.node.data.id);
    } else if (domain === 'NCBI' && type === 'Taxonomy') {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain + '_' + type] +
        data.node.data.id);
    } else if (domain === 'Text') {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain] +
        data.publicationId);
    } else {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain] +
        data.node.data.id.split(':')[1]);
    }
  }

  getName(data) {
    return data.node.displayName;
  }
}
