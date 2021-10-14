import { Component, Input, ViewEncapsulation } from '@angular/core';

import { SelectionEntity } from '../interfaces';

@Component({
  selector: 'app-sankey-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyDetailsPanelComponent {
  @Input() details: Array<SelectionEntity>;
}
