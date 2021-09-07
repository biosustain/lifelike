import { Component, Input, ViewEncapsulation, } from '@angular/core';


@Component({
  selector: 'app-sankey-advanced-panel-option',
  templateUrl: './advanced-panel-option.component.html',
  styleUrls: ['./advanced-panel-option.component.scss']
})
export class SankeyAdvancedPanelOptionComponent {
  @Input() title!: string;
  @Input() moreInfo: string;
}
