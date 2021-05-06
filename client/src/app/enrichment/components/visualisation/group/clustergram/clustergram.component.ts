import { Component, Input, OnChanges } from '@angular/core';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult, EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';
import { KeyValue } from '@angular/common';
import { ScrollDispatcher, ViewportRuler } from '@angular/cdk/scrolling';

class GeneRow {
  values: boolean[];
  frequency: number;
  others: number;

  constructor(sliceSize) {
    this.values = new Array(sliceSize);
    this.frequency = 0;
    this.others = 0;
  }
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  @Input() show: boolean;

  matches: Array<{ x: number, y: number }>;
  genes;
  others: GeneRow | undefined;
  goTerms: EnrichWithGOTermsResult[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;

  itemSize = [27, 27];

  constructor(
    readonly enrichmentService: EnrichmentVisualisationService,
    readonly scrollDispatcher: ScrollDispatcher,
    readonly viewportRuler: ViewportRuler
  ) {

  }

  rowOrder(a: KeyValue<string, GeneRow>, b: KeyValue<string, GeneRow>) {
    return b.value.frequency - a.value.frequency;
  }

  columnOrder(a: EnrichWithGOTermsResult, b: EnrichWithGOTermsResult) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    if (this.show) {
      const data = [...this.data].sort(this.columnOrder).map((o, i) => ({...o, x: i}));
      let genes = new Map<string, number>();
      const matches = [];
      data.forEach(({geneNames}, goIndex) => {
        geneNames.forEach(g => {
          matches.push({
            x: goIndex,
            y: g
          });
          let frequency = genes.get(g);
          if (!frequency) {
            genes.set(g, 1);
          } else {
            genes.set(g, ++frequency);
          }
        });
      });
      genes = new Map(
        [...genes]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v], i) => [k, i])
      );
      this.genes = [...genes].map(([key, i]) => ({key, y: i}));
      this.matches = matches
        .map(({x, y}) => ({x, y: genes.get(y)}));
      this.goTerms = data;
    }
  }
}
