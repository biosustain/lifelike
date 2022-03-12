import { Component, Input } from '@angular/core';

import { SankeyEntityDetailsComponent } from 'app/sankey/abstract/entity-details/entity-details.component';

import { SankeyMultiLaneLink } from '../../interfaces';

@Component({
  selector: 'app-sankey-multi-lane-link-details',
  templateUrl: './link-details.component.html'
})
export class SankeyMultiLaneLinkDetailsComponent extends SankeyEntityDetailsComponent {
  @Input() entity: SankeyMultiLaneLink;
}

