import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';

import { SankeySingleLaneState, SankeySingleLaneOptions } from '../interfaces';
import { customisedMultiValueAccessorId } from '../../../../services/sankey-controller.service';
import { SankeySingleLaneControllerService } from '../../services/sankey-single-lane-controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeySingleLaneAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeySingleLaneControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeySingleLaneOptions {
    // @ts-ignore
    return this.sankeyController.options;
  }

  get state(): SankeySingleLaneState {
    // @ts-ignore
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
