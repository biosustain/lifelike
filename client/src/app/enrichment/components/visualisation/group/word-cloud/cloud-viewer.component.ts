import { Component, OnChanges, Input, SimpleChanges } from '@angular/core';
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
  @Input() timeInterval = Infinity;
  @Input() show = true;

  ngOnChanges({data}: SimpleChanges) {
    const color = this.geneColor;
    if (this.show && data) {
      this.slicedData = Object.entries(
        data.currentValue.reduce((o, n) => {
          n.geneNames.forEach(g => {
            o[g] = o[g] || 0;
            o[g] += 1;
          });
          return o;
        }, {} as { [geneName: string]: number })
      )
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
        .slice(0, 250)
        .map(([text, frequency]) => ({text, frequency, color} as WordCloudNode));
    }
  }
}
