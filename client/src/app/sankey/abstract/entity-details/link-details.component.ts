import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyEntityDetailsComponent } from './entity-details.component';
import { ControllerService } from '../../services/controller.service';
import { MultiLaneBaseControllerService } from '../../base-views/multi-lane/services/multi-lane-base-controller.service';
import { SankeySingleLaneLink } from '../../base-views/single-lane/interfaces';

@Component({
  selector: 'app-sankey-link-details'
})
export class SankeyAbstractLinkDetailsComponent extends SankeyEntityDetailsComponent {
  constructor(
    protected common: ControllerService,
    protected baseView: MultiLaneBaseControllerService,
    protected readonly route: ActivatedRoute
  ) {
    super(common, route);
  }

  linkValueAccessors$ = this.common.linkValueAccessors$;
  linkValueAccessor$ = this.baseView.linkValueAccessor$;
}

