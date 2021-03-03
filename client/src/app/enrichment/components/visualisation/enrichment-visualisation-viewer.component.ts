import { Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Subscription } from 'rxjs';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { DownloadService } from 'app/shared/services/download.service';
import { FilesystemObject } from '../../../file-browser/models/filesystem-object';
import { FilesystemService } from '../../../file-browser/services/filesystem.service';
import { ProgressDialog } from '../../../shared/services/progress-dialog.service';

import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { MessageDialog } from '../../../shared/services/message-dialog.service';
import { WorkspaceManager } from '../../../shared/workspace-manager';
import { FilesystemObjectActions } from '../../../file-browser/services/filesystem-object-actions';
import { MatSnackBar } from '@angular/material';
import { EnrichmentVisualisationService } from '../../services/enrichment-visualisation.service';

@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [EnrichmentVisualisationService]
})
export class EnrichmentVisualisationViewerComponent implements OnInit, ModuleAwareComponent {

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


  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  loadTableTask: BackgroundTask<null, [FilesystemObject, EnrichmentVisualisationData]>;
  object: FilesystemObject;
  groups = new Set([
    'Biological Process',
    'Molecular Function',
    'Biological Process'
  ]);
  data = new Map([
    ['BiologicalProcess', undefined],
    ['MolecularFunction', undefined],
    ['CellularComponent', undefined]
  ]);

  loadingData: boolean;

  loadTask: BackgroundTask<string, []>;

  loadSubscription: Subscription;

  ngOnInit() {
    this.enrichmentService.loadTaskMetaData.results$.subscribe(({result}) => {
      this.object = result;
      this.emitModuleProperties();
    });
    this.loadTask = new BackgroundTask((analysis) =>
      this.enrichmentService.enrichWithGOTerms(analysis),
    );

    this.loadSubscription = this.loadTask.results$.subscribe((result) => {
      const data = result.result.sort((a, b) => a['p-value'] - b['p-value']);
      this.data.forEach((value, key, map) =>
          map.set(key, data.filter(d => d.goLabel.includes(key)))
      );
      this.loadingData = false;
    });
    this.enrichmentService.load.subscribe((data) => {
      this.loadTask.update('fisher');
    });
  }

  // End of changing enrichment params section.
  emitModuleProperties() {
    let title = 'Enrichment Visualisation';
    if (this.object) {
      title += ` for ${this.object.filename}`;
    }
    this.modulePropertiesChange.emit({
      title,
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
