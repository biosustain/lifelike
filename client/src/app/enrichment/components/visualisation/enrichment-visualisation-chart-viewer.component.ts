import { Component, Input, OnChanges, OnInit } from '@angular/core';


@Component({
  selector: 'app-enrichment-visualisation-chart-viewer',
  templateUrl: './enrichment-visualisation-chart-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
})
export class EnrichmentVisualisationChartViewerComponent implements OnInit, OnChanges {
  @Input() data: { gene: string, 'p-value': number }[];
  @Input() showMore;

  slicedData;

  slice() {
    this.slicedData = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 25);
  }

  ngOnInit() {
    this.slice();
  }

  ngOnChanges(change) {
    this.slice();
  }
}

export interface EnrichmentVisualisationData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
