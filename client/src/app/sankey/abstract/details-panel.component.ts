import { Component, ChangeDetectorRef } from '@angular/core';

import { map, tap } from 'rxjs/operators';
import { defer, groupBy, mapValues } from 'lodash-es';

import { SankeySelectionService } from '../services/selection.service';
import { SelectionType, SelectionEntity } from '../interfaces/selection';
import { ControllerService } from '../services/controller.service';
import { getTraces } from '../base-views/multi-lane/utils';

@Component({template: ''})
export abstract class SankeyAbstractDetailsPanelComponent {
  constructor(
    protected selectionService: SankeySelectionService
  ) {
  }

  SelectionType = SelectionType;

  details$ = this.selectionService.selection$;
}
