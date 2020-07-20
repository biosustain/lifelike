import {Component} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {SearchService} from 'app/search/services/search.service';
import {OrganismAutocomplete, FTSResult} from 'app/interfaces';

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
  templateUrl: './node-search.component.html',
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
  searchTerm = '';
  filter = 'labels(node)';
  domainsFilter = '';
  typesFilter = '';
  organismFilter: OrganismAutocomplete;

  constructor(
    private sanitizer: DomSanitizer,
    private searchService: SearchService,
  ) {
  }

  onNewSearchTerm(searchTerm: string) {
    this.searchTerm = searchTerm;
    this.search();
  }

  private search() {
    const handleResults = (results: FTSResult) => {
      this.getResults(results.nodes);
    };
    if (this.organismFilter) {
      this.searchService.
        getGenesFilteredByOrganism(this.searchTerm, this.organismFilter.tax_id, this.filter).
        subscribe(handleResults);
    } else {
      this.searchService.
        simpleFullTextSearch(this.searchTerm, 1, 100, this.filter).
        subscribe(handleResults);
    }
  }

  private filterComposer() {
    const filters = [this.domainsFilter, this.typesFilter];
    if (filters.every(f => f.length === 0)) {
      return 'labels(n)';
    }
    const nonEmptyFilters = filters.filter(f => f.length > 0);
    return this.intersperseValue(nonEmptyFilters, ' AND ');
  }

  private getResults(results) {
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

  private getDomain(subLabels: string[]) {
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

  private getType(subLabels: string[]) {
    this.removeUnneededLabels(subLabels);
    return subLabels.find(element => !element.match(/^db_*/));
  }

  private getLink(data) {
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

  private getName(data) {
    return data.node.displayName;
  }

  private getId(data) {
    return data.node.data.id;
  }

  getDomainsFilter(selectedDomains: string[]) {
    if (selectedDomains.length === 0) {
      this.domainsFilter = '';
    } else {
      this.domainsFilter = `(${this.intersperseValue(selectedDomains, ' OR ')})`;
    }
    this.filter = this.filterComposer();
    this.search();
  }

  getTypesFilter(selectedTypes: string[]) {
    if (selectedTypes.length === 0) {
      this.typesFilter = '';
    } else {
      this.typesFilter = `(${this.intersperseValue(selectedTypes, ' OR ')})`;
    }
    this.filter = this.filterComposer();
    this.search();
  }

  getOrganismFilter(organism: OrganismAutocomplete) {
    this.organismFilter = organism;
    this.search();
  }

  /**
   * @example
   * // returns 'azbzc'
   * intersperseValue(['a', 'b', 'c'], 'z');
   */
  private intersperseValue(arr: string[], value: string): string {
    const last = arr.length - 1;
    return arr.reduce((acc, curr, index) => {
      const s = `${acc}${curr}`;
      return index < last ? s + value : s;
    }, '');
  }
}
