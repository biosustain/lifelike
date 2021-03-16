import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { annotationTypesMap } from '../../../../../shared/annotation-styles';

const geneColor = annotationTypesMap.get('gene').color;

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnInit, OnChanges {
  @Input() data;
  @Input() showMore;

  genes = new Map();
  goTerms = [];
  geneColor = annotationTypesMap.get('gene').color;

  rowOrder(a, b) {
    return b.value.filter(d => d).length - a.value.filter(d => d).length;
  }

  columnOrder(a, b) {
    return b.geneNames.length - a.geneNames.length;
  }

  slice() {
    const data = (this.showMore ?
      this.data.slice(0, 50)
      : this.data.slice(0, 25))
      .sort(this.columnOrder);
    const genes = new Map();
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

  ngOnInit() {
    this.slice();
  }

  ngOnChanges(change) {
    this.slice();
  }
}
