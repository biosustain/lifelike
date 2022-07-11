import { Component, OnInit } from '@angular/core';

import { map } from 'rxjs/operators';

import { MultiLaneBaseControllerService } from '../../services/multi-lane-base-controller.service';

@Component({
  selector: 'app-sankey-legend',
  templateUrl: './sankey-legend.component.html',
  styleUrls: ['./sankey-legend.component.scss']
})
export class SankeyLegendComponent implements OnInit {
  constructor(
    protected baseView: MultiLaneBaseControllerService
  ) {
  }

  traceColors$ = this.baseView.traceGroupColorMapping$.pipe(
    map(mapping => Array.from(mapping.entries()).map(([group, color]) => ({group, color})))
  );

  ngOnInit(): void {
  }
}
