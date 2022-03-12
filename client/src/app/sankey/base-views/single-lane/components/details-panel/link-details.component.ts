import { Component, Input } from '@angular/core';

import { SankeyEntityDetailsComponent } from 'app/sankey/abstract/entity-details/entity-details.component';

import { SankeySingleLaneLink } from '../../interfaces';
import { SankeyAbstractLinkDetailsComponent } from '../../../../abstract/entity-details/link-details.component';

@Component({
  selector: 'app-sankey-single-lane-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeySingleLaneLinkDetailsComponent extends SankeyAbstractLinkDetailsComponent {
}

