import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { BehaviorSubject, Subscription } from 'rxjs';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { DownloadService } from 'app/shared/services/download.service';

import { WordCloudComponent } from './word-cloud/word-cloud.component';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../../file-browser/services/filesystem.service';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';

import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { FilesystemObjectActions } from '../../../file-browser/services/filesystem-object-actions';
import { MatSnackBar } from '@angular/material';
import { EnrichmentVisualisationService } from '../../services/enrichment-visualisation.service';
import { EnrichmentData } from './table/enrichment-table-viewer.component';
import { ENRICHMENT_TABLE_MIMETYPE } from '../../providers/enrichment-table.type-provider';
import { Progress } from '../../../interfaces/common-dialog.interface';
import { finalize } from 'rxjs/operators';
import { EnrichmentVisualisationEditDialogComponent } from './dialog/enrichment-visualisation-edit-dialog.component';
import { defaultAnalysis } from '../../analyses';

@Component({
  selector: 'app-enrichment-visualisation-group',
  templateUrl: './enrichment-visualisation-group.component.html',
  styleUrls: ['./enrichment-visualisation-group.component.scss']
})
export class EnrichmentVisualisationGroupComponent implements OnInit, OnDestroy, ModuleAwareComponent {

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
  @Input() data;

  @Input() geneNames: string[];
  @Input() organism: string;
  @Input() analysis: string;

  @Input() title;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  projectName: string;
  @Input() fileId: string;
  loadTableTask: BackgroundTask<null, [FilesystemObject, EnrichmentVisualisationData]>;
  object: FilesystemObject;
  neo4jId: number;
  importGenes: string[];
  unmatchedGenes: string;
  duplicateGenes: string;
  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  legend: Map<string, string> = new Map<string, string>();
  filtersPanelOpened = false;
  clickableWords = false;
  @ViewChild(WordCloudComponent, {static: false})
  private wordCloudComponent: WordCloudComponent;


  activeTab: string;

  scrollTopAmount: number;

  loadingData: boolean;

  cloudData: string[] = [];

  loadTask: BackgroundTask<string, [FilesystemObject]>;

  chartAnalysis = defaultAnalysis.id;

  wordCloudAnalysis = defaultAnalysis.id;

  ngOnDestroy() {
    console.log('sagr');
    // todo
  }

  updateChartParams(analysis) {
    this.chartAnalysis = analysis;
  }

  updateWordCloudParams(analysis) {
    this.wordCloudAnalysis = analysis;
  }

  shouldConfirmUnload() {
    return !!this.enrichmentService.unsavedChanges;
  }

  ngOnInit() {
    console.log("zxgf")
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentVisualisationEditDialog(): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentVisualisationEditDialogComponent);
    dialogRef.componentInstance.object = this.enrichmentService.object;
    dialogRef.componentInstance.data = this.enrichmentService.parameters;
    return dialogRef.result.then((result: EnrichmentData) => {
      const updatedFile = {
        parameters: Object.assign(this.enrichmentService.parameters, result),
        cachedResults: this.enrichmentService.cachedResults
      };
      const contentValue = new Blob([JSON.stringify(updatedFile)], {
        type: ENRICHMENT_TABLE_MIMETYPE,
      });

      const progressDialogRef = this.progressDialog.display({
        title: `Saving Parameters`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Updating enrichment visualisation parameters...',
        })),
      });

      // Push to backend to save
      this.filesystemService.save([this.object.hashId], {
        contentValue,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Edit enrichment visualisation'}),
        )
        .subscribe(() => {
          this.emitModuleProperties();
          this.snackBar.open('Enrichment visualisation updated.', null, {
            duration: 2000,
          });
          this.enrichmentService.loadTask.update();
        });
    }, () => {
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


export interface EnrichmentVisualisationParameters {
  genes: any;
  domains?: any;
  organism?: any;
}

export interface EnrichmentVisualisationData {
  parameters: EnrichmentVisualisationParameters;
  cachedResults: object;
}
