import { Component, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { combineLatest } from 'rxjs';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';

import { WordCloudService } from './services/word-cloud.service';
import { WordCloudComponent } from './word-cloud.component';

@Component({
  selector: 'app-word-cloud-project',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
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
      this.windowTitle = `Project Entity Cloud (${this.projectName})`;

      // Reset legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      this.setAnnotationData(annotationExport);

      // Need a slight delay between the data having been loaded and drawing the word cloud, seems like the BackgroundTask doesn't quite
      // adhere to the normal change detection cycle.
      setTimeout(() => {
        this.drawWordCloud(this.getFilteredAnnotationDeepCopy(), true);
      }, 10);
    });
    this.getAnnotations();
  }
}
