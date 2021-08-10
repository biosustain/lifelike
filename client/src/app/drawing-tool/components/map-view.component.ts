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
    /*
    let image_hashes = new Set();
    for (const node of this.graphCanvas.getGraph().nodes) {
      if (node.image_id !== undefined) { // is image node
        image_hashes.add(node.image_id);
        let oneImage$: Observable<CanvasImageSource> = this.mapImageProviderService.get(node.image_id)
        oneImage$.pipe(first()) // only take the first element
          .subscribe({
            next(img) {
              img = img as HTMLImageElement;
              console.log("image src is: " + img.src);
              // one way to get the original image blob. It's a PROMISE though
              let blob = fetch(img.src).then(r => r.blob());
              console.log("image blob is:");
              console.log(blob);
              console.log("END image blob");
            },
            error(msg) {
              console.error("error with subscriber: " + msg)
            }
          });
      }
    }
    console.log(image_hashes)
    if (image_hashes.size !== 0) {
      // TODO: save images. Otherwise no images so move on with regular save
    }
    */

    /*
    const contentValue = new Blob([JSON.stringify(this.graphCanvas.getGraph())], {
      type: MAP_MIMETYPE,
    }); // change this blob to include images (and zip it)
    */

    /** an example that might be working
     * var zip = new JSZip();
     * zip.file("Hello.txt", "Hello World\n");
     * var img = zip.folder("images");
     * img.file("smile.gif", imgData, {base64: true});
     * var content = zip.generate();
     * location.href="data:application/zip;base64,"+content;
     */

    let mapImages = new Map();
    for (const node of this.graphCanvas.getGraph().nodes) {
      if (node.image_id !== undefined) { // is image node
        mapImages.set(node.image_id, node.image_id);
        let oneImage$: Observable<CanvasImageSource> = this.mapImageProviderService.get(node.image_id)
        oneImage$.pipe(first()) // only take the first element
          .subscribe({
            async next(img) {
              img = img as HTMLImageElement;
              let imageBlob = await fetch(img.src).then(r => r.blob()); // TODO: wait til this is done before moving on
              console.log(imageBlob.type.substring(imageBlob.type.indexOf("/") + 1));
              mapImages.set(node.image_id, imageBlob);
            },
            error(msg) {
              console.error("error with subscriber: " + msg);
              // should we abort the save function as well?
            }
          });
      }
    } // at this point, `mapImages` has `image_id`s -> `image blob`s

    const contentValue = new JSZip();
    // look for zipping byte array or input streams, or make a tmp dir and zip from that
    const imgs = contentValue.folder("images");
    for (const id of mapImages) {
      const actualImg = mapImages.get(id);
      console.log("when zipping images");
      console.log(actualImg);
      imgs.file(id + actualImg.type.substring(actualImg.type.indexOf("/") + 1), actualImg, {base64: true});
    }

    contentValue.generateAsync({type: MAP_SHORTHAND})
      .then((contentValue) => {
        this.filesystemService.save([this.locator], {contentValue})
          .pipe(this.errorHandler.create({label: "Update Map"}))
          .subscribe(() => {
            this.unsavedChanges$.next(false);
            this.emitModuleProperties();
            this.snackBar.open('Map saved.', null, {
              duration: 2000,
            });
          })
      })
      /*

      // Push to backend to save
      this.filesystemService.save([this.locator], {
        contentValue,
      })
      .pipe(this.errorHandler.create({label: 'Update map'}))
      .subscribe(() => {
        this.unsavedChanges$.next(false);
        this.emitModuleProperties();
        this.snackBar.open('Map saved.', null, {
          duration: 2000,
        });
      });
      */
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
