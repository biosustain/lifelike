import { Component, OnChanges, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class DsfgsdfgcloudViewerComponent implements OnInit, OnChanges {
  @Input() data: { gene: string, 'p-value': number, geneNames: string[] }[];
  @Input() showMore;

  slicedData;

  slice() {
    this.slicedData = Object.entries(
      this.data.reduce((o, n) => {
        n['geneNames'].forEach(g => {
          o[g] = o[g] || 0;
          o[g] += 1;
        });
        return o;
      }, {})
    ).map(([text, frequency]) => ({text, frequency}));
  }

  ngOnInit() {
    this.slice();
  }

  ngOnChanges(change) {
    this.slice();
  }
}
