import { Component, ViewEncapsulation } from '@angular/core';

import { SankeyAbstractDetailsPanelComponent } from '../../../../abstract/details-panel.component';

@Component({
  selector: 'app-sankey-single-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeySingleLaneDetailsPanelComponent extends SankeyAbstractDetailsPanelComponent {
}
