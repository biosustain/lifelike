import { Component, ViewEncapsulation } from '@angular/core';

import { SankeySelectionService } from '../../services/selection.service';
import { SelectionType } from '../../interfaces';

@Component({
  selector: 'app-sankey-details-panel',
  templateUrl: './details-panel.component.html',
  styleUrls: ['./details-panel.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class SankeyDetailsPanelComponent {
  constructor(
    private selectionService: SankeySelectionService
  ) {
  }

  readonly SelectionType = SelectionType;

  details$ = this.selectionService.selection$;
}
