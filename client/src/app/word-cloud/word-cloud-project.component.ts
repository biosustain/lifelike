import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { combineLatest } from 'rxjs';
import { WordCloudService } from './services/word-cloud.service';
import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';

import { WordCloudComponent } from './word-cloud.component';

@Component({
  selector: 'app-word-cloud-project',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss'],
})
export class WordCloudProjectComponent extends WordCloudComponent {

  constructor(
    readonly route: ActivatedRoute,
    public pdf: PdfFilesService,
    public wordCloudService: WordCloudService,
    public legendService: LegendService,
  ) {
    super(route, pdf, wordCloudService, legendService);
  }

  initDataFetch() {
    this.loadTask = new BackgroundTask(() => {
      return combineLatest(
        this.legendService.getAnnotationLegend(),
        this.wordCloudService.getCombinedAnnotationsProject(this.projectName),
      );
    });
  }

  initWordCloud() {
    this.initDataFetch();
    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({
      result: [legend, annotationExport],
      value: [],
    }) => {
      this.windowTitle = this.projectName;

      // Reset legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      // Reset annotation data
      this.annotationData = [];
      this.wordVisibilityMap.clear();

      const tempIdTypePairSet = new Map<string, number>();
      const annotationList = annotationExport.split('\n');

      // remove the headers from tsv response
      annotationList.shift();
      // remove empty line at the end of the tsv response
      annotationList.pop();

      annotationList.forEach(e => {
        //  entity_id	  type	  text	  count
        //  col[0]      col[1]  col[2]  col[3]
        const cols = e.split('\t');
        const idTypePair = cols[0] + cols[1];

        if (!tempIdTypePairSet.has(idTypePair)) {
          const annotation = {
            id: cols[0],
            type: cols[1],
            color: this.legend.get(cols[1].toLowerCase()), // Set lowercase to match the legend
            text: cols[2],
            frequency: parseInt(cols[3], 10),
            shown: true,
          } as WordCloudAnnotationFilterEntity;
          this.wordVisibilityMap.set(annotation.text, true);
          this.annotationData.push(annotation);
          tempIdTypePairSet.set(idTypePair, this.annotationData.length - 1);
        } else {
          // Add the frequency of the synonym to the original word
          this.annotationData[tempIdTypePairSet.get(idTypePair)].frequency += parseInt(cols[3], 10);

          // TODO: In the future, we may want to show "synonyms" somewhere, or even allow the user to swap out the most frequent term for a
          // synonym
        }
      });
      // Need to sort the data, since we may have squashed some terms down and messed with the order given by the API
      this.annotationData = this.annotationData.sort((a, b) => b.frequency - a.frequency);

      // Need a slight delay between the data having been loaded and drawing the word cloud, seems like the BackgroundTask doesn't quite
      // adhere to the normal change detection cycle.
      setTimeout(() => {
        this.drawWordCloud(this.getFilteredAnnotationDeepCopy(), true);
      }, 10);
    });
    this.getAnnotations();
  }
}
