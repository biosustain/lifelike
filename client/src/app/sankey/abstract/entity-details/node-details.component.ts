import { Component, Input, } from '@angular/core';

import { SankeyNode } from 'app/sankey/interfaces';

import { SankeyEntityDetailsComponent } from './entity-details.component';


@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
export class SankeyNodeDetailsComponent extends SankeyEntityDetailsComponent {
  @Input() entity: SankeyNode;

  biocycLink(biocycId) {
    return 'https://biocyc.org/ECOLI/NEW-IMAGE?object=' + encodeURIComponent(biocycId);
  }

  reactomeLink(stId) {
    return 'https://reactome.org/content/detail/' + encodeURIComponent(stId);
  }
}
