import { Component, ViewEncapsulation } from '@angular/core';

import { SankeyDetailsPanelComponent } from '../../../../components/details-panel/details-panel.component';

@Component({
  selector: 'app-sankey-single-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySingleLaneDetailsPanelComponent extends SankeyDetailsPanelComponent {
}
