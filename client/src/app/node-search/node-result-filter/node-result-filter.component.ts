import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {MatListOption} from '@angular/material/list';

@Component({
  selector: 'app-node-result-filter',
  templateUrl: './node-result-filter.component.html',
  styleUrls: ['./node-result-filter.component.scss']
})


export class NodeResultFilterComponent implements OnInit {
  typeOfDomains: string[] = ['CHEBI', 'MESH', 'NCBI', 'GO', 'UNIPROT'].sort();
  typeOfGoClasses: string[] = ['MOLECULAR_FUNCTION', 'CELLULAR_COMPONENT', 'BIOLOGICAL_PROCESS'].sort();
  typesOfEntities: string[] = ['GENE', 'CHEMICAL', 'DISEASES', 'TAXONOMY', 'PROTEIN'].sort();
  selectedDomains: string[] = [];
  selectedGoClasses: string[] = [];
  selectedTypes: string[] = [];
  @Output() domainsFilter = new EventEmitter<string[]>();
  @Output() goClassesFilter = new EventEmitter<string[]>();
  @Output() typesFilter = new EventEmitter<string[]>();

  DOMAINS_LABEL = {
    CHEBI: 'n:db_CHEBI',
    GO: 'n:db_GO',
    MESH: 'n:db_MESH',
    NCBI: 'n:db_NCBI',
    UNIPROT: 'n:db_UniProt'
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

  getGoClasses(options: MatListOption[]) {
    this.selectedGoClasses = options.map(option => {
      return 'n.namespace="' + (option.value).toString().toLowerCase() + '"';
    });
    this.goClassesFilter.emit(this.selectedGoClasses);
  }

  getTypes(options: MatListOption[]) {
    this.selectedTypes = options.map(option => {
      return 'n:' + this.capitalize((option.value).toString().toLowerCase());
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
