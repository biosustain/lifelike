import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SankeyAbstractLinkDetailsComponent } from '../../../../abstract/entity-details/link-details.component';
import { BaseControllerService } from '../../../../services/base-controller.service';
import { Base } from '../../interfaces';
import { SankeyTraceLink, SankeyLink } from '../../../../model/sankey-document';

@Component({
  selector: 'app-sankey-single-lane-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeySingleLaneLinkDetailsComponent extends SankeyAbstractLinkDetailsComponent<Base> {
  constructor(
    protected baseView: BaseControllerService<Base>,
    protected readonly route: ActivatedRoute
  ) {
    super(baseView, route);
  }

  entity: SankeyLink;
}

