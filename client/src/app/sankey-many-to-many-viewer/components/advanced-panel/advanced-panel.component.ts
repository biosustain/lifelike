import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyManyToManyAdvancedOptions } from '../interfaces';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyManyToManyAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeyManyToManyAdvancedOptions {
    // @ts-ignore
    return this.sankeyController.options;
  }

  update() {
    this.sankeyController.applyOptions();
  }

  customSizingUpdate() {
    this.options.selectedPredefinedValueAccessor = {
      description: 'Customised',
      callback: () => {}
    };
    this.update();
  }
}
