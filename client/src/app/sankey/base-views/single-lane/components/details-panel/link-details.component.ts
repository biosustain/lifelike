import { Component, Input } from '@angular/core';

import { SankeySingleLaneLink } from '../interfaces';
import { SankeyAbstractDetailsComponent } from '../../../../abstract/details-panel.component';

@Component({
  selector: 'app-sankey-link-details',
  templateUrl: './link-details.component.html',
  styleUrls: ['./link-details.component.scss']
})
export class SingleLaneLinkDetailsComponent extends SankeyAbstractDetailsComponent {
  @Input() entity: SankeySingleLaneLink;
}

