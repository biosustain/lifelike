import { Component, OnChanges, OnInit, ViewChild } from '@angular/core';

import { Subscription } from 'rxjs';

import { EnrichmentVisualisationService } from '../../../services/enrichment-visualisation.service';

import { WordCloudComponent } from '../../../../shared/components/word-cloud/word-cloud.component';
import { BackgroundTask } from '../../../../shared/rxjs/background-task';


@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent {
  loadingData: boolean;

  data: { text: any; frequency: any }[] = [];

  loadTask: BackgroundTask<string, any>;
  loadSubscription: Subscription;
}
