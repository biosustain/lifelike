import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';

import { SankeyMultiLaneControllerService } from '../../services/sankey-multi-lane-controller.service';
import { SankeyAdvancedPanelComponent } from '../../../../components/advanced-panel/advanced-panel.component';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyMultiLaneAdvancedPanelComponent extends SankeyAdvancedPanelComponent {
}
