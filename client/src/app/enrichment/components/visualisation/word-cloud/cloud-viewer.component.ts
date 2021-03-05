import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

import { Subscription } from 'rxjs';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { EnrichmentVisualisationService } from '../../../services/enrichment-visualisation.service';

import { WordCloudComponent } from '../../../../shared/components/word-cloud/word-cloud.component';
import { BackgroundTask } from '../../../../shared/rxjs/background-task';


@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent implements OnInit, ModuleAwareComponent, OnChanges {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @Input() geneNames: string[];
  @Input() organism: string;
  @Input() analysis: string;
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  clickableWords = false;
  @ViewChild(WordCloudComponent, {static: false})
  private wordCloudComponent: WordCloudComponent;


  loadingData: boolean;

  data: { text: any; frequency: any }[] = [];

  loadTask: BackgroundTask<string, any>;
  loadSubscription: Subscription;

  constructor(protected readonly enrichmentService: EnrichmentVisualisationService,
              protected readonly errorHandler: ErrorHandler) {
    this.loadTask = new BackgroundTask(() =>
      this.enrichmentService.getGOSignificance(),
    );

    this.loadSubscription = this.loadTask.results$.subscribe((result) => {
     // tslint:disable-next-line:no-string-literal
      this.data = result.result.map(d => ({text: d['gene'], frequency: d['n_related_GO_terms']}));
      this.loadingData = false;
    });
  }

  ngOnInit() {
    this.loadingData = true;
    this.loadTask.update();
  }

  ngOnChanges() {
    this.loadingData = true;
    this.loadTask.update();
  }
}
