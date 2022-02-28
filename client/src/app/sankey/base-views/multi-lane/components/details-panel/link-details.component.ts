import { Component, Input } from '@angular/core';

import { SankeyAbstractDetailsComponent } from 'app/sankey/abstract/details-panel.component';

import { SankeyMultiLaneLink } from '../../interfaces';

@Component({
  selector: 'app-sankey-multi-lane-link-details',
  templateUrl: './link-details.component.html'
})
export class SankeyMultiLaneLinkDetailsComponent extends SankeyAbstractDetailsComponent {
  @Input() entity: SankeyMultiLaneLink;
}

