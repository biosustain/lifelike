import { Component, Input, OnChanges } from '@angular/core';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult, EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';
import { KeyValue } from '@angular/common';

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
  others: GeneRow | undefined;
  goTerms: EnrichWithGOTermsResult[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;

  constructor(readonly enrichmentService: EnrichmentVisualisationService) {
  }

  rowOrder(a: KeyValue<string, GeneRow>, b: KeyValue<string, GeneRow>) {
    return b.value.frequency - a.value.frequency;
  }

  columnOrder(a: EnrichWithGOTermsResult, b: EnrichWithGOTermsResult) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    if (this.show) {
      const data = [...this.data].sort(this.columnOrder);
      const genes = new Map<string, number>();
      const matches = [];
      data.forEach(({geneNames}, goIndex) => {
        geneNames.forEach(g => {
          matches.push({
            y: goIndex,
            x: g
          });
          let frequency = genes.get(g);
          if (!frequency) {
            genes.set(g, 1);
          } else {
            genes.set(g, ++frequency);
          }
        });
      });
      this.matches = matches
        .map(({x, y}) => ({y, x: genes.get(x)}))
        .sort((a, b) => b.y - a.y || b.x - b.x);
      this.goTerms = data;
    }
  }
}
