import { Component, Input, } from '@angular/core';

@Component({
  selector: 'app-sankey-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
})
export class SankeyDetailsPanelComponent {
  @Input() details;
}
