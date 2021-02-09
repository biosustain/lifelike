import {Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';

import {NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {Subscription} from 'rxjs';
import {ModuleAwareComponent, ModuleProperties} from 'app/shared/modules';
import {BackgroundTask} from 'app/shared/rxjs/background-task';
import {ErrorHandler} from 'app/shared/services/error-handler.service';
import {DownloadService} from 'app/shared/services/download.service';

import {WordCloudComponent} from './word-cloud/word-cloud.component';
import {FilesystemObject} from '../../../file-browser/models/filesystem-object';
import {FilesystemService} from '../../../file-browser/services/filesystem.service';
import {ProgressDialog} from '../../../shared/services/progress-dialog.service';

import {EnrichmentTableService} from '../../services/enrichment-table.service';
import {MessageDialog} from '../../../shared/services/message-dialog.service';
import {WorkspaceManager} from '../../../shared/workspace-manager';
import {FilesystemObjectActions} from '../../../file-browser/services/filesystem-object-actions';
import {MatSnackBar} from '@angular/material';
import {EnrichmentVisualisationService} from '../../services/enrichment-visualisation.service';

@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [EnrichmentVisualisationService]
})
export class EnrichmentVisualisationViewerComponent implements OnInit, OnDestroy, ModuleAwareComponent {
  @Input() titleVisible = true;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  projectName: string;
  @Input() fileId: string;
  geneNames: string[];
  organism: string;
  loadTableTask: BackgroundTask<null, [FilesystemObject, EnrichmentVisualisationData]>;
  object: FilesystemObject;
  data: EnrichmentVisualisationData;
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  columnOrder: string[] = [];
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  legend: Map<string, string> = new Map<string, string>();
  filtersPanelOpened = false;
  clickableWords = false;
  @ViewChild(WordCloudComponent, {static: false})
  private wordCloudComponent: WordCloudComponent;


  scrollTopAmount: number;

  loadingData: boolean;

  cloudData: string[] = [];

  loadTask: BackgroundTask<string, [FilesystemObject]>;
  loadSubscription: Subscription;

  selectedRow = 0;

  constructor(protected readonly messageDialog: MessageDialog,
              protected readonly ngZone: NgZone,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly filesystemObjectActions: FilesystemObjectActions,
              protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              readonly enrichmentService: EnrichmentVisualisationService,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly downloadService: DownloadService,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog) {
    this.enrichmentService.fileId = this.route.snapshot.params.file_id || '';
    this.loadingData = true;
  }

  ngOnDestroy() {
    console.log("sagr")
    // todo
  }

  shouldConfirmUnload() {
    return !!this.enrichmentService.unsavedChanges;
  }

  ngOnInit() {
    this.enrichmentService.loadTask.results$.subscribe(({result: {object, data}}) => {
      this.object = object;
      this.loadingData = false;
      this.emitModuleProperties();
    });
  }


  // End of changing enrichment params section.

  emitModuleProperties() {
    this.modulePropertiesChange.emit({
      title: this.object ? this.object.filename : 'Enrichment Visualisation',
      fontAwesomeIcon: 'chart-bar',
    });
  }
}

export interface EnrichmentVisualisationData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
