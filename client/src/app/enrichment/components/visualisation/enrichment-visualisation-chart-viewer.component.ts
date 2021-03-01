import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-enrichment-visualisation-chart-viewer',
  templateUrl: './enrichment-visualisation-chart-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
})
export class EnrichmentVisualisationChartViewerComponent {
  @Input() data: { gene: string, 'p-value': number }[];
  @Input() showMore;
}

export interface EnrichmentVisualisationData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
