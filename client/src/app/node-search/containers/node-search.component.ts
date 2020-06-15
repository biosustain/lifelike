import {Component} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';

export interface Nodes {
  id: string;
  link: string;
  domain: string;
  type: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-search-collection-page',
  template: `
    <app-node-search-bar
      (results)="getResults($event)"
      [domainsFilter]="domainsFilter"
      [typesFilter]="typesFilter"
    ></app-node-search-bar>
    <app-node-result-filter
      (domainsFilter)="getDomainsFilter($event)"
      (typesFilter)="getTypesFilter($event)"
    ></app-node-result-filter>
    <app-node-result-list
      [nodes]="dataSource"
    ></app-node-result-list>
  `,
})
export class NodeSearchComponent {

  DOMAINS_URL = {
    CHEBI: 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=',
    MESH: 'https://www.ncbi.nlm.nih.gov/mesh/?term=',
    UniProt: 'https://www.uniprot.org/uniprot/',
    GO: 'http://amigo.geneontology.org/amigo/term/',
    NCBI_Gene: 'https://www.ncbi.nlm.nih.gov/gene/',
    NCBI_Taxonomy: 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id='
  };
  dataSource: Nodes[] = [];
  domainsFilter = '';
  typesFilter = '';

  constructor(private sanitizer: DomSanitizer) {
  }

  getResults(results) {
    this.dataSource = results.map((data) => {
      return {
        id: this.getId(data),
        link: this.getLink(data),
        name: this.getName(data),
        type: this.getType(data.node.subLabels),
        domain: this.getDomain(data.node.subLabels),
        description: data.taxonomyId !== 'N/A' ?
          data.taxonomyName + ' (' + data.taxonomyId + ')' :
          this.getType(data.node.subLabels) === 'GO' && data.goClass !== 'N/A' ?
            data.goClass : 'N/A'
      } as Nodes;
    });
  }


  getDomain(subLabels: string[]) {
    this.removeUnneededLabels(subLabels);
    return subLabels.find(element => element.match(/^db_*/))
      .split('_')[1];
  }

  private removeUnneededLabels(subLabels: string[]) {
    const tobeRemovedLabels = ['db_Literature', 'TopicalDescriptor'];
    tobeRemovedLabels.forEach(label => {
      const index = subLabels.indexOf(label);
      if (index !== -1) {
        subLabels.splice(index, 1);
      }
    });
  }

  getType(subLabels: string[]) {
    this.removeUnneededLabels(subLabels);
    return subLabels.find(element => !element.match(/^db_*/));
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
    } else if (domain === 'GO' || domain === 'UniProt') {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain] +
        data.node.data.id);
    } else {
      return this.sanitizer.bypassSecurityTrustUrl(this.DOMAINS_URL[domain] +
        data.node.data.id.split(':')[1]);
    }
  }

  getName(data) {
    return data.node.displayName;
  }

  getId(data) {
    return data.node.data.id;
  }

  getDomainsFilter(selectedDomains: string[]) {
    let domainsPredicate = '(';
    if (selectedDomains.length === 0) {
      this.domainsFilter = '';
      return;
    }
    selectedDomains.forEach((domain, index) => {
      if (selectedDomains.length - 1 === index) {
        return domainsPredicate += domain + ')';
      }
      domainsPredicate += domain + ' OR ';
    });
    this.domainsFilter = domainsPredicate;
  }

  getTypesFilter(selectedTypes: string[]) {
    let typesPredicate = '(';
    if (selectedTypes.length === 0) {
      this.typesFilter = '';
      return;
    }
    selectedTypes.forEach((type, index) => {
      if (selectedTypes.length - 1 === index) {
        return typesPredicate += type + ')';
      }
      typesPredicate += type + ' OR ';
    });
    this.typesFilter = typesPredicate;
  }
}
