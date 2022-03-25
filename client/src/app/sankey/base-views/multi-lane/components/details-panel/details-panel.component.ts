import { Component, ViewEncapsulation } from '@angular/core';

import { SankeyAbstractDetailsPanelComponent } from '../../../../abstract/details-panel.component';

@Component({
  selector: 'app-sankey-multi-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyMutiLaneDetailsPanelComponent extends SankeyAbstractDetailsPanelComponent {
}