import { Component, Input, EventEmitter, Output, } from '@angular/core';
import { SankeyAdvancedOptions } from '../interfaces';
import { uuidv4 } from '../../../shared/utils';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent {
  @Input() options!: SankeyAdvancedOptions;
  @Output() optionsChange = new EventEmitter<SankeyAdvancedOptions>();

  uuid: string;

  constructor() {
    this.uuid = uuidv4();
  }

  update() {
    this.optionsChange.emit(this.options);
  }

  customSizingUpdate() {
    this.options.selectedPredefinedValueAccessor = {
      description: 'Customised',
      callback: () => {}
    };
    this.update();
  }
}
