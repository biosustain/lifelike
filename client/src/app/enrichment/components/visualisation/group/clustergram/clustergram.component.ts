import { Component, Input, OnChanges, OnInit } from '@angular/core';

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnInit, OnChanges {
  @Input() data: { gene: string, 'p-value': number, geneNames: string[] }[];
  @Input() showMore;

  genes = new Map();
  goTerms = [];

  slice() {
    const data = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 25);
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
