import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Subscription } from 'rxjs';

import { DownloadService } from 'app/shared/services/download.service';

import { MapComponent } from './map.component';
import { MapExportDialogComponent } from './map-export-dialog.component';
import { MapService } from '../services';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ShareDialogComponent } from '../../shared/components/dialog/share-dialog.component';
import { ModuleAwareComponent } from '../../shared/modules';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { WorkspaceManager } from '../../shared/workspace-manager';

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: [
    './map.component.scss',
  ],
})
export class MapViewComponent<ExtraResult = void> extends MapComponent<ExtraResult>
    implements OnDestroy, AfterViewInit, ModuleAwareComponent {
  @Input() titleVisible = true;

  paramsSubscription: Subscription;
  queryParamsSubscription: Subscription;

  returnUrl: string;

  hasEditPermission = true;

  constructor(mapService: MapService,
              snackBar: MatSnackBar,
              modalService: NgbModal,
              messageDialog: MessageDialog,
              ngZone: NgZone, route: ActivatedRoute,
              errorHandler: ErrorHandler,
              workspaceManager: WorkspaceManager,
              filesystemService: FilesystemService,
              readonly downloadService: DownloadService) {
    super(mapService, snackBar, modalService, messageDialog, ngZone, route, errorHandler, workspaceManager, filesystemService);

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    this.paramsSubscription = this.route.params.subscribe(params => {
      this.locator = {
        projectName: params.project_name,
        hashId: params.hash_id,
      };
    });
  }

// ========================================
  // Angular events
  // ========================================

  ngOnDestroy() {
    super.ngOnDestroy();
    this.queryParamsSubscription.unsubscribe();
    this.paramsSubscription.unsubscribe();
  }

  shouldConfirmUnload() {
    return this.unsavedChanges$.getValue();
  }

  // ========================================
  // States
  // ========================================

  /**
   * Save the current representation of knowledge model
   */
  save() {
    this.map.graph = this.graphCanvas.getGraph();
    this.map.modified_date = new Date().toISOString();

    // Push to backend to save
    this.mapService.updateMap(this.locator.projectName, this.map)
        .pipe(this.errorHandler.create())
        .subscribe(() => {
          this.unsavedChanges$.next(false);
          this.emitModuleProperties();
          this.snackBar.open('Map saved.', null, {
            duration: 2000,
          });
        });
  }

  // ========================================
  // Download
  // ========================================

  /**
   * Asks for the format to download the map
   */
  download() {
    if (this.unsavedChanges$.getValue()) {
      this.messageDialog.display({
        title: 'Save Required',
        message: 'Please save your changes before exporting.',
        type: MessageType.Error,
      });
    } else {
      this.modalService.open(MapExportDialogComponent).result.then(format => {
        if (format === 'pdf') {
          this.downloadPDF();
        } else if (format === 'svg') {
          this.downloadSVG();
        } else if (format === 'png') {
          this.downloadPNG();
        } else {
          throw new Error('invalid format');
        }
      }, () => {
      });
    }
  }

  /**
   * Saves and downloads the PDF version of the current map
   */
  downloadPDF() {
    this.downloadService.requestDownload(
      this.map.label,
      () => this.mapService.generateExport(this.locator.projectName, this.locator.hashId, 'pdf'),
      'application/pdf',
      '.pdf',
    );
  }

  /**
   * Saves and downloads the SVG version of the current map
   */
  downloadSVG() {
    this.downloadService.requestDownload(
      this.map.label,
      () => this.mapService.generateExport(this.locator.projectName, this.locator.hashId, 'svg'),
      'application/svg',
      '.svg',
    );
  }

  /**
   * Saves and downloads the PNG version of the current map
   */
  downloadPNG() {
    this.downloadService.requestDownload(
      this.map.label,
      () => this.mapService.generateExport(this.locator.projectName, this.locator.hashId, 'png'),
      'application/png',
      '.png',
    );
  }

  // ========================================
  // Template stuff
  // ========================================

  goToReturnUrl() {
    if (this.shouldConfirmUnload()) {
      if (confirm('Leave editor? Changes you made may not be saved.')) {
        this.workspaceManager.navigateByUrl(this.returnUrl);
      }
    } else {
      this.workspaceManager.navigateByUrl(this.returnUrl);
    }
  }

  displayShareDialog() {
    const modalRef = this.modalService.open(ShareDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/projects/`
      + `${this.locator.projectName}/maps/${this.locator.hashId}?fromWorkspace`;
  }
}
