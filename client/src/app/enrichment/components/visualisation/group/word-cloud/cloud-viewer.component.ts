import { Component, OnChanges, Input } from '@angular/core';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';
import { WordCloudNode } from 'app/shared/components/word-cloud/word-cloud.component';
import { WorkspaceManager } from '../../../../../shared/workspace-manager';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { paramsToEnrichmentTableLink } from '../../components/link/link.directive';

@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  geneColor = annotationTypesMap.get('gene').color;

  slicedData: WordCloudNode[];
  link;

  constructor(
    private workspaceManager: WorkspaceManager,
    private route: ActivatedRoute
  ) {
    route.params.pipe(
      map(paramsToEnrichmentTableLink)
    ).subscribe(
      link => {
        this.link = link;
      }
    );
  }

  onClick(d) {
    this.workspaceManager.navigateByUrl(this.link.appLink.join('/'), {
      fragment: d.text,
      sideBySide: true,
      newTab: true,
      matchExistingTab: this.link.matchExistingTab
    });
  }

  enter(selection) {
    selection.on('click', this.onClick.bind(this))
      .style('cursor', 'pointer');
  }

  ngOnChanges() {
    const color = this.geneColor;
    this.slicedData = Object.entries(
      this.data.reduce((o, n) => {
        n.geneNames.forEach(g => {
          o[g] = o[g] || 0;
          o[g] += 1;
        });
        return o;
      }, {} as { [geneName: string]: number })
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
      .map(([text, frequency]) => ({text, frequency, color} as WordCloudNode));
    console.log(this.slicedData);
  }
}
