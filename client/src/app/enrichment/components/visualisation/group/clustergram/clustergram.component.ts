import { Component, Input, OnChanges } from '@angular/core';
import { annotationTypesMap } from '../../../../../shared/annotation-styles';
import { EnrichWithGOTermsResult } from '../../../../services/enrichment-visualisation.service';

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;

  genes = new Map<string, boolean[]>();
  goTerms: EnrichWithGOTermsResult[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;

  rowOrder(a: { value: [] }, b: { value: [] }) {
    return b.value.filter(d => d).length - a.value.filter(d => d).length;
  }

  columnOrder(a: { geneNames: [] }, b: { geneNames: [] }) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    const data = (this.showMore ?
      this.data.slice(0, 50)
      : this.data.slice(0, 25))
      .sort(this.columnOrder);
    const genes = new Map<string, boolean[]>();
    data.forEach((goTerm, goIndex) => {
      goTerm.geneNames.forEach(g => {
        let geneRow = genes.get(g);
        if (!geneRow) {
          geneRow = new Array(data.length);
          genes.set(g, geneRow);
        }
        geneRow[goIndex] = true;
      });
    });
    this.genes = genes;
    this.goTerms = data;
  }
}
