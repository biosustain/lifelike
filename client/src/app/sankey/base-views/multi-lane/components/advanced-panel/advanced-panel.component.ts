import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';

import { SankeyMultiLaneControllerService } from '../../services/sankey-multi-lane-controller.service';


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
    this.sankeyController.state$.subscribe(state => {
      this.state = state;
    });
  }

  state;

  update(event?) {
    // todo: add event listener
    console.log(event);
  }
}
