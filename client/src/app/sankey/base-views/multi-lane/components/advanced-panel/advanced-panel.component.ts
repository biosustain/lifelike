import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';
import { SankeyOptions, SankeyState } from 'app/sankey/interfaces';

import { SankeyMultiLaneControllerService, customisedMultiValueAccessorId } from '../../services/sankey-multi-lane-controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyMultiLaneAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyMultiLaneControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeyOptions {
    return this.sankeyController.options;
  }

  get state(): SankeyState {
    return this.sankeyController.state;
  }

  update() {
    this.sankeyController.applyState();
  }

  customSizingUpdate() {
    this.state.predefinedValueAccessorId = customisedMultiValueAccessorId;
    this.update();
  }
}
