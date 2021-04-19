import { Component, Input, OnChanges } from '@angular/core';
import { annotationTypesMap } from '../../../../../shared/annotation-styles';
import { EnrichWithGOTermsResult, EnrichmentVisualisationService } from '../../../../services/enrichment-visualisation.service';
import { KeyValue } from '@angular/common';

interface GeneRow {
  values: boolean[];
  frequency: number;
  others: number;
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;

  genes = new Map<string, GeneRow>();
  others: GeneRow;
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
    const data = this.data.sort(this.columnOrder);
    const sliceSize = Math.min(data.length, this.showMore ? 50 : 25);
    const genes = new Map<string, GeneRow>();
    let others;
    const {importGenes} = this.enrichmentService.enrichmentDocument;
    const goTerms = data.slice(0, sliceSize);
    data.slice(0, sliceSize).forEach(({geneNames}, goIndex) => {
      importGenes.filter(value => geneNames.includes(value)).forEach(g => {
        let geneRow = genes.get(g);
        if (!geneRow) {
          geneRow = {values: new Array(sliceSize), frequency: 0, others: 0} as GeneRow;
          genes.set(g, geneRow);
        }
        geneRow.frequency++;
        geneRow.values[goIndex] = true;
      });
    });
    data.slice(sliceSize).forEach(({geneNames}, goIndex) => {
      importGenes.filter(value => geneNames.includes(value)).forEach(g => {
        let geneRow = genes.get(g);
        if (!geneRow) {
          others = geneRow = others || {values: new Array(sliceSize), frequency: 0, others: 0} as GeneRow;
        }
        geneRow.frequency++;
        geneRow.others++;
      });
    });
    this.genes = genes;
    this.others = others;
    this.goTerms = goTerms;
  }
}
