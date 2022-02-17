import { Component, Input } from '@angular/core';

import { SankeySingleLaneLink } from '../../interfaces';
import { SankeyAbstractDetailsComponent } from '../../../../abstract/details-panel.component';

@Component({
  selector: 'app-sankey-single-lane-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SankeySingleLaneLinkDetailsComponent extends SankeyAbstractDetailsComponent {
  @Input() entity: SankeySingleLaneLink;
}
