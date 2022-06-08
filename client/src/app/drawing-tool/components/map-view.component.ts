import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { Subscription, forkJoin } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { cloneDeep } from 'lodash-es';
import { defaultIfEmpty } from 'rxjs/operators';

import { ModuleAwareComponent } from 'app/shared/modules';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { getObjectLabel } from 'app/file-browser/utils/objects';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import { ImageBlob } from 'app/shared/utils/forms';

import { MapComponent } from './map.component';
import { MapImageProviderService } from '../services/map-image-provider.service';
import { GraphActionsService } from '../services/graph-actions.service';

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

  isSaving = false;

  returnUrl: string;

  constructor(filesystemService: FilesystemService,
              objectTypeService: ObjectTypeService,
              snackBar: MatSnackBar,
              modalService: NgbModal,
              messageDialog: MessageDialog,
              ngZone: NgZone, route: ActivatedRoute,
              errorHandler: ErrorHandler,
              workspaceManager: WorkspaceManager,
              filesystemObjectActions: FilesystemObjectActions,
              dataTransferDataService: DataTransferDataService,
              mapImageProviderService: MapImageProviderService,
              public readonly progressDialog: ProgressDialog,
              graphActionsService: GraphActionsService) {
    super(filesystemService, snackBar, modalService, messageDialog, ngZone, route,
      errorHandler, workspaceManager, filesystemObjectActions, dataTransferDataService,
      mapImageProviderService, objectTypeService, graphActionsService);

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    this.paramsSubscription = this.route.params.subscribe(params => {
      this.locator = params.hash_id;
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.queryParamsSubscription.unsubscribe();
    this.paramsSubscription.unsubscribe();
  }

  shouldConfirmUnload() {
    return this.unsavedChanges$.getValue();
  }

  /**
   * Save the current representation of the map.
   */
  save() {
    this.unsavedChanges$.next(false);
    this.isSaving = true;

    const { newImageHashes, deletedImages } = this.graphCanvas.getImageChanges();
    const newImageBlobs = newImageHashes.map(hash => this.mapImageProviderService.getBlob(hash));
    const graphString = JSON.stringify(this.graphCanvas.getGraph());
    const bytes = new TextEncoder().encode(graphString);
    const content = new Blob([bytes], {
      type: 'application/json;charset=utf-8'
    });
    const hashesOfLinked = Array.from(this.graphCanvas.getHashesOfLinked());
    // DefaultIfEmpty ensures that we always call the subscription - even if there are no images
    forkJoin(newImageBlobs).pipe(defaultIfEmpty([])).subscribe((imageBlobs: Blob[]) => {
      const newImages: ImageBlob[] = [];
      for (let i = 0; i < imageBlobs.length; i++) {
        newImages.push({
          blob: imageBlobs[i],
          filename: newImageHashes[i],
        });
      }
      this.filesystemService.save([this.locator], {
        contentValue: content, newImages, hashesOfLinked, deletedImages
      })
        .pipe(this.errorHandler.create({label: 'Update map'}))
        .subscribe(() => {
          this.graphCanvas.saveImagesState();
          this.isSaving = false;
          this.emitModuleProperties(); // TODO: what does this do?
          this.snackBar.open('Map saved.', null, {
            duration: 2000,
          });
        }, () => {
          this.unsavedChanges$.next(true);
          this.isSaving = false;
        });
    });

  }

  openCloneDialog() {
    const newTarget: FilesystemObject = cloneDeep(this.map);
    newTarget.public = false;
    return this.filesystemObjectActions.openCloneDialog(newTarget).then(clone => {
      this.workspaceManager.navigate(clone.getCommands(), {
        newTab: true,
      });
      this.snackBar.open(`Copied ${getObjectLabel(this.map)} to ${getObjectLabel(clone)}.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }

  openVersionHistoryDialog() {
    return this.filesystemObjectActions.openVersionHistoryDialog(this.map);
  }

  openExportDialog() {
    if (this.unsavedChanges$.getValue()) {
      this.messageDialog.display({
        title: 'Save Required',
        message: 'Please save your changes before exporting.',
        type: MessageType.Error,
      } as MessageArguments);
    } else {
      return this.filesystemObjectActions.openExportDialog(this.map);
    }
  }

  openShareDialog() {
    return this.filesystemObjectActions.openShareDialog(this.map);
  }

  openNewWindow() {
    return this.filesystemObjectActions.openNewWindow(this.map);
  }

  goToReturnUrl() {
    if (this.shouldConfirmUnload()) {
      if (confirm('Leave editor? Changes you made may not be saved.')) {
        this.workspaceManager.navigateByUrl({url: this.returnUrl});
      }
    } else {
      this.workspaceManager.navigateByUrl({url: this.returnUrl});
    }
  }
}
