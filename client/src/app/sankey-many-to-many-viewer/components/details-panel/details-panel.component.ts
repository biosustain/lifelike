import { Component, Input, ViewEncapsulation } from '@angular/core';

import { SankeyDetailsPanelComponent } from 'app/sankey-viewer/components/details-panel/details-panel.component';
import { SelectionEntity } from 'app/sankey-viewer/components/interfaces';

@Component({
  selector: 'app-sankey-many-to-many-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyManyToManyDetailsPanelComponent extends SankeyDetailsPanelComponent {
  @Input() details: Array<SelectionEntity>;
}
