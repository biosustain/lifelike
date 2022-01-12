import { Component, Input } from '@angular/core';

import { SankeyLinkDetailsComponent } from 'app/sankey/components/details-panel/link-details.component';

import { SankeySingleLaneLink } from '../interfaces';

@Component({
  selector: 'app-sankey-single-lane-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeySingleLaneLinkDetailsComponent extends SankeyLinkDetailsComponent {
  @Input() entity: SankeySingleLaneLink;
}

