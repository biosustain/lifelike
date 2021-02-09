import {Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';

import {NgbModal} from '@ng-bootstrap/ng-bootstrap';

import {Subscription} from 'rxjs';
import {ModuleAwareComponent, ModuleProperties} from 'app/shared/modules';
import {ErrorHandler} from 'app/shared/services/error-handler.service';
import {DownloadService} from 'app/shared/services/download.service';

import {EnrichmentVisualisationService} from '../../services/enrichment-visualisation.service';

import {FilesystemObject} from '../../../file-browser/models/filesystem-object';
import {FilesystemService} from '../../../file-browser/services/filesystem.service';
import {ProgressDialog} from '../../../shared/services/progress-dialog.service';

import {MessageDialog} from '../../../shared/services/message-dialog.service';
import {WorkspaceManager} from '../../../shared/workspace-manager';
import {FilesystemObjectActions} from '../../../file-browser/services/filesystem-object-actions';
import {MatSnackBar} from '@angular/material';


@Component({
  selector: 'app-enrichment-visualisation-chart-viewer',
  templateUrl: './enrichment-visualisation-chart-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss']
})
export class EnrichmentVisualisationChartViewerComponent implements OnInit, OnDestroy, ModuleAwareComponent {
  @Input() titleVisible = true;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  @Input() geneNames: string[];
  @Input() organism: string;
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


  scrollTopAmount: number;

  loadingData: boolean;


  selectedRow = 0;

  constructor(protected readonly messageDialog: MessageDialog,
              protected readonly ngZone: NgZone,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly filesystemObjectActions: FilesystemObjectActions,
              protected readonly route: ActivatedRoute,
              protected readonly enrichmentService: EnrichmentVisualisationService,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly downloadService: DownloadService,
              protected readonly snackBar: MatSnackBar,
              protected readonly filesystemService: FilesystemService,
              protected readonly progressDialog: ProgressDialog) {
    this.loadingData = true;
  }

  ngOnDestroy() {
    console.log('asfgdsa')
  }

  shouldConfirmUnload() {
    return this.enrichmentService.unsavedChanges.getValue();
  }

  // events
  public chartClick({event, active}: { event: MouseEvent, active: {}[] }): void {
    console.log('active', active[0]);
    if (active[0]) {
      this.selectedRow = (active[0] as any)._index;
    }
  }

  ngOnInit() {
    this.enrichmentService.enrichWithGOTerms().subscribe((result) => {
      this.data = result;
      this.loadingData = false;
    });
  }


  scrollTop() {
    this.scrollTopAmount = 0;
  }
}

export interface EnrichmentVisualisationData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: string;
}
