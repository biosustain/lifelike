import { Component, OnChanges, OnInit, Input } from '@angular/core';
import { annotationTypesMap } from '../../../../../shared/annotation-styles';

@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent implements OnInit, OnChanges {
  @Input() data: { gene: string, 'p-value': number, geneNames: string[] }[];
  @Input() showMore;
  geneColor = annotationTypesMap.get('gene').color;

  slicedData;

  slice() {
    const color = this.geneColor;
    this.slicedData = Object.entries(
      this.data.reduce((o, n) => {
        n.geneNames.forEach(g => {
          o[g] = o[g] || 0;
          o[g] += 1;
        });
        return o;
      }, {})
    ).map(([text, frequency]) => ({text, frequency, color}));
  }

  ngOnInit() {
    this.slice();
  }

  ngOnChanges(change) {
    this.slice();
  }
}
