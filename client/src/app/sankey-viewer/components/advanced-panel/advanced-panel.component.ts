import { Component, } from '@angular/core';
import { SankeyAdvancedOptions } from '../interfaces';
import { uuidv4 } from '../../../shared/utils';
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
    this.sankeyController.optionsChange();
  }

  customSizingUpdate() {
    this.options.selectedPredefinedValueAccessor = {
      description: 'Customised'
    };
    this.update();
  }
}
