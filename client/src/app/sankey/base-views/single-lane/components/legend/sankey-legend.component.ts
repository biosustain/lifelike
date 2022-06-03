import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';

import { map, tap } from 'rxjs/operators';

import { isNotEmpty } from 'app/shared/utils';

import { SingleLaneBaseControllerService } from '../../services/single-lane-base-controller.service';
import { SankeySelectionService } from '../../../../services/selection.service';

@Component({
  selector: 'app-sankey-legend',
  templateUrl: './sankey-legend.component.html',
  styleUrls: ['./sankey-legend.component.scss']
})
export class SankeyLegendComponent implements OnInit {

  constructor(
    protected baseView: SingleLaneBaseControllerService,
    protected selectionService: SankeySelectionService
  ) {
  }

  colorLinkTypes$ = this.baseView.colorLinkTypes$;
  colorLinkByType$ = this.baseView.colorLinkByType$;
  selected$ = this.selectionService.selection$.pipe(
    map(selection => isNotEmpty(selection))
  );

  ngOnInit(): void {
  }
}
