import { Component, OnChanges, OnInit, Input } from '@angular/core';
import { annotationTypesMap } from '../../../../../shared/annotation-styles';
import { EnrichWithGOTermsResult } from '../../../../services/enrichment-visualisation.service';
import { WordCloudNode } from '../../../../../shared/components/word-cloud/word-cloud.component';

@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  geneColor = annotationTypesMap.get('gene').color;

  slicedData: WordCloudNode[];

  ngOnChanges() {
    const color = this.geneColor;
    this.slicedData = Object.entries(
      this.data.reduce((o, n) => {
        n.geneNames.forEach(g => {
          o[g] = o[g] || 0;
          o[g] += 1;
        });
        return o;
      }, {})
    ).map(([text, frequency]) => ({text, frequency, color} as WordCloudNode));
  }
}
