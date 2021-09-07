import { AfterViewInit, Component, Input, NgZone, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Observable, Subscription, combineLatest } from 'rxjs';
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
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
    let zip = new JSZip();
    let imgs = zip.folder('images');
    const imageIds: string[] = []
    const imageNodeObservables: Observable<Blob>[] = []
    for (const node of this.graphCanvas.getGraph().nodes) {
      if (node.image_id !== undefined) { // is image
        imageIds.push(node.image_id);
        imageNodeObservables.push(this.mapImageProviderService.getBlob(node.image_id));
      }
    }
    /**
     * here we have an array of observables, they might emit value at any time
     * so we use `combineLatest` to grab all of the values emitted by these observables
     * in the callback function, `imageBlobs` is an array of blobs emitted
     *     by these observables
     * and they are in the SAME order as the imageNodeObservables, which is why iterating
     *     through 2 arrays could work
     * a better way might be to use HashMap (`Map` in typescript) but maps don't have
     *     functions like `combineLatest`
     */
    zip.file("graph.json", JSON.stringify(this.graphCanvas.getGraph()));
    // graph has no images
    if (imageNodeObservables.length === 0) {
      console.log('no images if');
      zip.generateAsync({ type: 'blob' }).then((content) => {
        this.filesystemService.save([this.locator], { contentValue: content })
          .pipe(this.errorHandler.create({label: 'Update map'}))
          .subscribe(() => {
            this.unsavedChanges$.next(false);
            this.emitModuleProperties(); // TODO: what does this do?
            this.snackBar.open('Map saved.', null, {
              duration: 2000,
            });
          });
      });
      return; // terminate function so we don't move on to "with image" part
    }
    // has images, wait for all image observables to emit value, then save blobs
    combineLatest(imageNodeObservables).subscribe((imageBlobs: Blob[]) => {
      for (let i = 0; i < imageIds.length; i++) {
        imgs.file(imageIds[i] + '.png', imageBlobs[i]);
      }
      zip.generateAsync({ type: "blob" })
        .then((content) => {
          // saveAs(content, 'map.zip'); // uncomment this line to download and verify that the generated zip file is correct
          this.filesystemService.save([this.locator], { contentValue: content })
            .pipe(this.errorHandler.create({label: 'Update map'}))
            .subscribe(() => {
              this.unsavedChanges$.next(false);
              this.emitModuleProperties();
              this.snackBar.open('Map saved.', null, {
                duration: 2000,
              });
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
