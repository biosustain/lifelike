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

  @Input('data') set data(data) {
    this.genes = [...data.reduce((o, n) => n.geneNames.forEach(o.add.bind(o)) || o, new Set())];
    const genes = new Map();
    data.forEach((goTerm, goIndex)=>{
      goTerm.geneNames.forEach(g=>{
        let gene_row = genes.get(g);
        if(!gene_row) {
          gene_row = Array(data.length).fill()
          genes.set(g, gene_row);
        }
        gene_row[goIndex] = true;
      });
    });
    this.genes = genes;
    this.goTerms = data;
  }

  get data() {
    return this._data;
  }

  private _data: any[] = [];

  genes = [];
  goTerms = [];
}
