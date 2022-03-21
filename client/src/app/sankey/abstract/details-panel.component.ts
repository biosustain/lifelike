import { Component } from '@angular/core';

import { SankeySelectionService } from '../services/selection.service';
import { SelectionType } from '../interfaces/selection';

@Component({ template: '' })
export class SankeyAbstractDetailsPanelComponent {
  constructor(
    protected selectionService: SankeySelectionService
  ) {
  }

  readonly SelectionType = SelectionType;

  details$ = this.selectionService.selection$;
}
