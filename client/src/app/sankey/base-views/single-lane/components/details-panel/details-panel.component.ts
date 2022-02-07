import { Component, Input, ViewEncapsulation } from '@angular/core';

import { SankeyDetailsPanelComponent } from 'app/sankey/components/details-panel/details-panel.component';

import { SankeySingleLaneSelection } from '../interfaces';

@Component({
  selector: 'app-sankey-single-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySingleLaneDetailsPanelComponent extends SankeyDetailsPanelComponent {
  @Input() details: Array<SankeySingleLaneSelection>;
}
