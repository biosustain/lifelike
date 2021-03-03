import { Component, Input } from '@angular/core';


interface Node {
  value?: any;
  result?: any;
  frequency: any;
  text?: any;
  shown?: any;
  id?: any;
  type?: any;
  color?: any;
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent {
  @Input() data: { gene: string, 'p-value': number, geneNames: string[] }[];
  @Input() showMore;

  slice() {
    const data = this.showMore ? this.data.slice(0, 50) : this.data.slice(0, 25);
    const genes = new Map();
    data.forEach((goTerm, goIndex) => {
      goTerm.geneNames.forEach(g => {
        let gene_row = genes.get(g);
        if (!gene_row) {
          gene_row = new Array(data.length);
          genes.set(g, gene_row);
        }
        gene_row[goIndex] = true;
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

  genes = new Map();
  goTerms = [];
}
