import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyAbstractLinkDetailsComponent } from '../../../../abstract/entity-details/link-details.component';
import { BaseControllerService } from '../../../../services/base-controller.service';
import { SankeyBaseOptions, SankeyBaseState } from '../../../interfaces';

@Component({
  selector: 'app-sankey-single-lane-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeySingleLaneLinkDetailsComponent extends SankeyAbstractLinkDetailsComponent {
  constructor(
    protected baseView: BaseControllerService<SankeyBaseOptions, SankeyBaseState>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView, route);
  }
}

