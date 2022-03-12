import { Component, Input, } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyNode } from 'app/sankey/interfaces';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { ControllerService } from '../../services/controller.service';
import { MultiLaneBaseControllerService } from '../../base-views/multi-lane/services/multi-lane-base-controller.service';


@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
export class SankeyNodeDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected common: ControllerService,
    protected baseView: MultiLaneBaseControllerService,
    protected readonly route: ActivatedRoute
  ) {
    super(common, route);
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
