import { Component, Input, EventEmitter, Output, } from '@angular/core';
import { SankeyAdvancedOptions } from '../interfaces';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent {
  @Input() options!: SankeyAdvancedOptions;
  @Output() optionsChange = new EventEmitter<SankeyAdvancedOptions>();

  update($event) {
    console.log($event);
    this.optionsChange.emit(this.options);
  }

  customSizingUpdate($event) {
    console.log($event);
    this.options.selectedPredefinedValueAccessor = {
      description: 'Customised'
    };
    this.update({});
  }
}
