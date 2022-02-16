import { Component, Input, ViewEncapsulation } from '@angular/core';

import { SankeySelectionService } from '../../services/selection.service';

@Component({
  selector: 'app-sankey-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyDetailsPanelComponent {
  constructor(
    private selectionService: SankeySelectionService
  ) {  }

  details$ = this.selectionService.selection$;
}
