import { Component } from '@angular/core';

import { SankeySelectionService } from '../services/selection.service';
import { SelectionType } from '../interfaces/selection';

@Component({ template: '' })
export abstract class SankeyAbstractDetailsPanelComponent {
  constructor(protected selectionService: SankeySelectionService) {}

  SelectionType = SelectionType;

  readonly details$ = this.selectionService.selection$;
}
