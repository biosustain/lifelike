import { Component, Input, } from '@angular/core';

@Component({
  selector: 'app-sankey-panel',
  templateUrl: './panel.component.html',
  styleUrls: ['./panel.component.scss'],
})
export class SankeyPanelComponent {
  @Input() details;
}
