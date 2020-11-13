import { AfterViewInit, Component, Input } from '@angular/core';

import { uuidv4 } from 'app/drawing-tool/services';

declare const Plotly: any;

@Component({
  selector: 'app-plotly-sankey-diagram',
  templateUrl: './plotly-sankey-diagram.component.html',
  styleUrls: ['./plotly-sankey-diagram.component.scss']
})
export class PlotlySankeyDiagramComponent implements AfterViewInit {
  @Input() config: any;
  @Input() data: any;

  sankeyContainerId: string;

  constructor() {
    this.sankeyContainerId = uuidv4();
  }

  ngAfterViewInit() {
    const container = document.getElementById(this.sankeyContainerId);
    Plotly.newPlot(
      container,
      [this.data],
      this.config,
      { staticPlot: false }
    );
  }
}
