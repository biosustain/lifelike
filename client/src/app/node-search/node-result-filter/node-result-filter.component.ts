import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-node-result-filter',
  templateUrl: './node-result-filter.component.html',
  styleUrls: ['./node-result-filter.component.scss']
})
export class NodeResultFilterComponent implements OnInit {
  typeOfDomains: string[] = ['CHEBI', 'MESH', 'NCBI', 'GO'].sort();
  typesOfEntities: string[] = ['GENES', 'CHEMICAL', 'DISEASES', 'TAXONOMY', 'SNIPPET'].sort();
  constructor() { }

  ngOnInit() {
  }

}
