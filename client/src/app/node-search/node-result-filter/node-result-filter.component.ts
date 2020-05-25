import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {MatListOption} from '@angular/material/list';

@Component({
  selector: 'app-node-result-filter',
  templateUrl: './node-result-filter.component.html',
  styleUrls: ['./node-result-filter.component.scss']
})


export class NodeResultFilterComponent implements OnInit {
  typeOfDomains: string[] = ['CHEBI', 'MESH', 'NCBI', 'LITERATURE'].sort();
  typesOfEntities: string[] = ['GENE', 'CHEMICAL', 'DISEASES', 'TAXONOMY', 'SNIPPET'].sort();
  selectedDomains: string[] = [];
  selectedTypes: string[] = [];
  @Output() domainsFilter = new EventEmitter<string[]>();
  @Output() typesFilter = new EventEmitter<string[]>();

  DOMAINS_LABEL = {
    CHEBI: 'node:db_CHEBI',
    LITERATURE: 'node:db_Literature',
    MESH: 'node:db_MESH',
    NCBI: 'node:db_NCBI'
  };

  constructor() {
  }

  ngOnInit() {
  }

  getDomains(options: MatListOption[]) {
    this.selectedDomains = options.map(option => {
      return this.DOMAINS_LABEL[option.value];
    });
    this.domainsFilter.emit(this.selectedDomains);
  }

  getTypes(options: MatListOption[]) {
    this.selectedTypes = options.map(option => {
      return 'node:' + this.capitalize((option.value).toString().toLowerCase());
    });
    this.typesFilter.emit(this.selectedTypes);
  }

  capitalize(s: string) {
    if (typeof s !== 'string') {
      return '';
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

}
