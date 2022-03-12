import { Component, ViewEncapsulation, Injectable } from '@angular/core';

import { SankeySelectionService } from '../services/selection.service';
import { SelectionType } from '../interfaces';

@Component({})
export class SankeyAbstractDetailsPanelComponent {
  constructor(
    private selectionService: SankeySelectionService
  ) {
  }

  readonly SelectionType = SelectionType;

  details$ = this.selectionService.selection$;
}
