import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackgroundTask } from 'app/shared/rxjs/background-task';

import { LegendService } from 'app/shared/services/legend.service';
import { PdfFilesService } from 'app/shared/services/pdf-files.service';
import { combineLatest, Subscription } from 'rxjs';

import { WordCloudService } from './services/word-cloud.service';
import { WordCloudComponent } from './word-cloud.component';
import { WordCloudAnnotationFilterEntity } from '../interfaces/annotation-filter.interface';
import { FileViewComponent } from '../file-browser/components/file-view.component';
import { WorkspaceManager } from '../shared/workspace-manager';
import { escapeRegExp } from 'lodash';

@Component({
  selector: 'app-word-cloud-file-navigator',
  templateUrl: './word-cloud-file-navigator.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WordCloudFileNavigatorComponent extends WordCloudComponent
    implements OnInit, OnDestroy {

  clickableWords = true;
  private wordOpenSubscription: Subscription;

  constructor(
      readonly route: ActivatedRoute,
      readonly router: Router,
      public pdf: PdfFilesService,
      public wordCloudService: WordCloudService,
      public legendService: LegendService,
      public workspaceManager: WorkspaceManager,
  ) {
    super(route, pdf, wordCloudService, legendService);
  }

  ngOnInit() {
    this.wordOpenSubscription = this.wordOpen.subscribe((annotation: WordCloudAnnotationFilterEntity) => {
      const url = [
        '/projects',
        encodeURIComponent(this.projectName),
        'files',
        encodeURIComponent(this.fileId),
      ].join('/');

      this.workspaceManager.navigateByUrl(`${url}#annotation=${encodeURIComponent(annotation.id)}`, {
        newTab: true,
        sideBySide: true,
        matchExistingTab: `^/*${escapeRegExp(url)}.*`,
        shouldReplaceTab: component => {
          const fileViewComponent = component as FileViewComponent;
          fileViewComponent.highlightAnnotation(annotation.id);
          return false;
        },
      });
    });
  }

  ngOnDestroy() {
    this.wordOpenSubscription.unsubscribe();
  }

  initDataFetch() {
    this.loadTask = new BackgroundTask(() => {
      return combineLatest(
          this.legendService.getAnnotationLegend(),
          this.wordCloudService.getCombinedAnnotations(this.projectName, this.fileId),
      );
    });
  }

  initWordCloud() {
    this.initDataFetch();
    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({
                                                                    result: [legend, annotationExport],
                                                                    value: [],
                                                                  }) => {
      this.windowTitle = 'Word Cloud';

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
