import {Component, EventEmitter, Output} from '@angular/core';
import {MatListOption} from '@angular/material/list';
import {OrganismAutocomplete} from 'app/interfaces';

@Component({
  selector: 'app-node-result-filter',
  templateUrl: './node-result-filter.component.html',
  styleUrls: ['./node-result-filter.component.scss']
})
export class NodeResultFilterComponent {
  typeOfDomains: string[] = ['CHEBI', 'MESH', 'NCBI', 'GO', 'UNIPROT'].sort();
  typesOfEntities: string[] = ['GENE', 'CHEMICAL', 'DISEASE', 'TAXONOMY', 'PROTEIN'].sort();
  selectedDomains: string[] = [];
  selectedTypes: string[] = [];
  @Output() domainsFilter = new EventEmitter<string[]>();
  @Output() goClassesFilter = new EventEmitter<string[]>();
  @Output() typesFilter = new EventEmitter<string[]>();
  @Output() organismFilter = new EventEmitter<OrganismAutocomplete|null>();

  DOMAINS_LABEL = {
    CHEBI: 'n:db_CHEBI',
    GO: 'n:db_GO',
    MESH: 'n:db_MESH',
    NCBI: 'n:db_NCBI',
    UNIPROT: 'n:db_UniProt'
  };

  getDomains(options: MatListOption[]) {
    this.selectedDomains = options.map(option => {
      return this.DOMAINS_LABEL[option.value];
    });
    this.domainsFilter.emit(this.selectedDomains);
  }

  getTypes(options: MatListOption[]) {
    this.selectedTypes = options.map(option => {
      return 'n:' + this.capitalize((option.value).toString().toLowerCase());
    });
    this.typesFilter.emit(this.selectedTypes);
  }

  getOrganism(organism: OrganismAutocomplete|null) {
    this.organismFilter.emit(organism);
  }

  capitalize(s: string) {
    if (typeof s !== 'string') {
      return '';
    }
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
