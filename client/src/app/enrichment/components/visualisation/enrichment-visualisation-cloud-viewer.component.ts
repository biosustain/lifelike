import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

import { Subscription } from 'rxjs';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { EnrichmentVisualisationService } from '../../services/enrichment-visualisation.service';

import { WordCloudComponent } from './word-cloud/word-cloud.component';
import { BackgroundTask } from '../../../shared/rxjs/background-task';


@Component({
  selector: 'app-enrichment-visualisation-cloud-viewer',
  templateUrl: './enrichment-visualisation-cloud-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss']
})
export class EnrichmentVisualisationCloudViewerComponent implements OnInit, OnDestroy, ModuleAwareComponent, OnChanges {
  @Input() titleVisible = true;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

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

  selectedRow = 0;
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

  ngOnDestroy() {
    // todo
  }

  shouldConfirmUnload() {
    return this.enrichmentService.unsavedChanges.getValue();
  }

  setCloudData() {
    // this.data = this.data[this.selectedRow].Genes.split(';');
  }

  // events
  public chartClick({event, active}: { event: MouseEvent, active: {}[] }): void {
    console.log('active', active[0]);
    if (active[0]) {
      this.selectedRow = (active[0] as any)._index;
      this.setCloudData();
    }
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
