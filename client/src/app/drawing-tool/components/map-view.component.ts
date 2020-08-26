import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { MapService } from '../services';

import { MapExportDialogComponent } from './map-export-dialog.component';
import { ModuleAwareComponent } from '../../shared/modules';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { tap } from 'rxjs/operators';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { Progress } from '../../interfaces/common-dialog.interface';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { MapComponent } from './map.component';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';

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

  hasEditPermission = false;

  constructor(mapService: MapService,
              snackBar: MatSnackBar,
              modalService: NgbModal,
              messageDialog: MessageDialog,
              ngZone: NgZone, route: ActivatedRoute,
              errorHandler: ErrorHandler,
              workspaceManager: WorkspaceManager,
              public readonly progressDialog: ProgressDialog) {
    super(mapService, snackBar, modalService, messageDialog, ngZone, route, errorHandler, workspaceManager);

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
    this.map.date_modified = new Date().toISOString();

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

  private requestDownload(project: () => Observable<any>, mimeType: string, extension: string) {
    if (this.unsavedChanges$.getValue()) {
      this.snackBar.open('Please save the project before exporting', null, {
        duration: 2000,
      });
    } else {
      const progressDialogRef = this.progressDialog.display({
        title: `Export`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Generating the requested export...',
        })),
      });

      project().pipe(
          tap(
              () => progressDialogRef.close(),
              () => progressDialogRef.close()),
          this.errorHandler.create(),
      ).subscribe(resp => {
        // It is necessary to create a new blob object with mime-type explicitly set
        // otherwise only Chrome works like it should
        const newBlob = new Blob([resp], {
          type: mimeType,
        });

        // IE doesn't allow using a blob object directly as link href
        // instead it is necessary to use msSaveOrOpenBlob
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(newBlob);
          return;
        }

        // For other browsers:
        // Create a link pointing to the ObjectURL containing the blob.
        const data = window.URL.createObjectURL(newBlob);

        const link = document.createElement('a');
        link.href = data;
        link.download = this.map.label + extension;
        // this is necessary as link.click() does not work on the latest firefox
        link.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }));

        setTimeout(() => {
          // For Firefox it is necessary to delay revoking the ObjectURL
          window.URL.revokeObjectURL(data);
          link.remove();
        }, 100);
      });
    }
  }

  /**
   * Saves and downloads the PDF version of the current map
   */
  downloadPDF() {
    this.requestDownload(
        () => this.mapService.generateExport(this.locator.projectName, this.locator.hashId, 'pdf'),
        'application/pdf',
        '.pdf',
    );
  }

  /**
   * Saves and downloads the SVG version of the current map
   */
  downloadSVG() {
    this.requestDownload(
        () => this.mapService.generateExport(this.locator.projectName, this.locator.hashId, 'svg'),
        'application/svg',
        '.svg',
    );
  }

  /**
   * Saves and downloads the PNG version of the current map
   */
  downloadPNG() {
    this.requestDownload(
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
}
