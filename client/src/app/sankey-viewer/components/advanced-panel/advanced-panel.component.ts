import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';

import { SankeyAdvancedOptions } from '../interfaces';
import { SankeyControllerService } from '../../services/sankey-controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeyAdvancedOptions {
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
