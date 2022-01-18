import { Component, } from '@angular/core';

import { combineLatest } from 'rxjs';

import { uuidv4 } from 'app/shared/utils';

import { SankeyBaseViewControllerService } from '../../services/sankey-base-view-controller.service';

@Component({
  selector: 'app-advanced-panel'
})
export class SankeyAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyBaseViewControllerService
  ) {
    this.uuid = uuidv4();

    combineLatest([
      this.sankeyController.state$,
      this.sankeyController.options$,
    ]).subscribe(([state, options]) => {
      this.options = options;
      this.state = state;
    });
  }

  state: any;
  options: any;

  update() {
    this.sankeyController.applyState();
  }

  customSizingUpdate() {
    // todo
    // this.state.predefinedValueAccessorId = customisedMultiValueAccessorId;
    this.update();
  }
}
