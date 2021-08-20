import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Observable, Subscription } from 'rxjs';
import { ModuleAwareComponent } from 'app/shared/modules';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { MapComponent } from './map.component';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { FilesystemService } from '../../file-browser/services/filesystem.service';
import { FilesystemObject} from '../../file-browser/models/filesystem-object';
import { FilesystemObjectActions } from '../../file-browser/services/filesystem-object-actions';
import { getObjectLabel } from '../../file-browser/utils/objects';
import { cloneDeep } from 'lodash';
import { MAP_MIMETYPE, MAP_SHORTHAND } from '../providers/map.type-provider';
import { DataTransferDataService } from '../../shared/services/data-transfer-data.service';
import { MapImageProviderService } from '../services/map-image-provider.service';
import { first } from 'rxjs/operators';
import JSZip from 'jszip';

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

  constructor(filesystemService: FilesystemService,
              snackBar: MatSnackBar,
              modalService: NgbModal,
              messageDialog: MessageDialog,
              ngZone: NgZone, route: ActivatedRoute,
              errorHandler: ErrorHandler,
              workspaceManager: WorkspaceManager,
              filesystemObjectActions: FilesystemObjectActions,
              dataTransferDataService: DataTransferDataService,
              mapImageProviderService: MapImageProviderService,
              public readonly progressDialog: ProgressDialog) {
    super(filesystemService, snackBar, modalService, messageDialog, ngZone, route,
      errorHandler, workspaceManager, filesystemObjectActions, dataTransferDataService,
      mapImageProviderService);

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
   * Save the current representation of knowledge model
   */
  save() {
                  /**
                   * steps to approach:
                   * zip the map w/o images
                   * get the raw image from ???
                   * zip the map w/ images
                   * unzip the map, populate image from `image_id`
                   */
    const zip = new JSZip();
    const { filesystemService, locator, unsavedChanges$, emitModuleProperties, snackBar, errorHandler } = this;
    zip.file("graph.json", JSON.stringify(this.graphCanvas.getGraph()));
    zip.generateAsync({ type: "blob" })
      .then(function (content) {
        console.log("here's content");
        console.log(content);
        filesystemService.save([locator], { contentValue: content })
          .pipe(errorHandler.create({label: 'Update map'}))
          .subscribe(() => {
            unsavedChanges$.next(false);
            emitModuleProperties();
            snackBar.open('Map saved.', null, {
              duration: 2000,
            });
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
        this.workspaceManager.navigateByUrl(this.returnUrl);
      }
    } else {
      this.workspaceManager.navigateByUrl(this.returnUrl);
    }
  }
}
