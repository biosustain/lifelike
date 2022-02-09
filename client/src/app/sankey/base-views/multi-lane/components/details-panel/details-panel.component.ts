import { Component, Input, ViewEncapsulation } from '@angular/core';

import { SelectionEntity } from 'app/sankey/interfaces';

import { SankeyDetailsPanelComponent } from '../../../../components/details-panel/details-panel.component';

@Component({
  selector: 'app-sankey-multi-lane-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyMutiLaneDetailsPanelComponent extends SankeyDetailsPanelComponent {
}
