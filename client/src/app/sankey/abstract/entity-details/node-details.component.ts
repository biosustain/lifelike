import { Component, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { BaseControllerService } from '../../services/base-controller.service';
import { SankeyBaseOptions, SankeyBaseState } from '../../base-views/interfaces';


@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
export class SankeyNodeDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<SankeyBaseOptions, SankeyBaseState>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView.common, route);
  }

  nodeValueAccessors$ = this.common.nodeValueAccessors$;
  nodeValueAccessor$ = this.baseView.nodeValueAccessor$;

  biocycLink(biocycId) {
    return 'https://biocyc.org/ECOLI/NEW-IMAGE?object=' + encodeURIComponent(biocycId);
  }

  reactomeLink(stId) {
    return 'https://reactome.org/content/detail/' + encodeURIComponent(stId);
  }
}
