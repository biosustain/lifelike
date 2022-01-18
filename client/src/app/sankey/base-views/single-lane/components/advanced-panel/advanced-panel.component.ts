import { Component, } from '@angular/core';

import { combineLatest } from 'rxjs';

import { uuidv4 } from 'app/shared/utils';

import { SankeySingleLaneState, SankeySingleLaneOptions } from '../interfaces';
import { customisedMultiValueAccessorId } from '../../../../services/sankey-controller.service';
import { SankeySingleLaneControllerService } from '../../services/sankey-single-lane-controller.service';
import { SankeyAdvancedPanelComponent } from '../../../../components/advanced-panel/advanced-panel.component';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeySingleLaneAdvancedPanelComponent extends SankeyAdvancedPanelComponent {
}
