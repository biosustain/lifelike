import { EventEmitter, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

import { isNil } from 'lodash-es';
import { merge as _merge } from 'lodash/fp';
import { BehaviorSubject } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';

import { Progress } from 'app/interfaces/common-dialog.interface';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { openInternalLink, toValidUrl } from 'app/shared/utils/browser';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { openDownloadForBlob } from 'app/shared/utils/files';
import {
  WorkspaceManager,
  WorkspaceNavigationExtras,
} from 'app/workspace/services/workspace-manager';
import { ProgressDialog } from 'app/shared/modules/dialog/services/progress-dialog.service';

import { FilesystemObject } from '../models/filesystem-object';
import { getObjectLabel } from '../utils/objects';
import { FilesystemObjectActions } from './filesystem-object-actions';
import { FilesystemService } from './filesystem.service';

/**
 * High-level service for actions on object list.
 */
@Injectable()
export class ObjectListService {
  constructor(
    protected readonly router: Router,
    protected readonly snackBar: MatSnackBar,
    protected readonly progressDialog: ProgressDialog,
    protected readonly errorHandler: ErrorHandler,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly actions: FilesystemObjectActions,
    protected readonly filesystemService: FilesystemService
  ) {}

  public objectOpen: EventEmitter<FilesystemObject> = new EventEmitter();
  public refreshRequest: EventEmitter<string> = new EventEmitter();

  objectDragStart(
    $event: DragEvent,
    object: FilesystemObject,
    objects: CollectionModel<FilesystemObject>
  ) {
    const dataTransfer: DataTransfer = $event.dataTransfer;
    // TODO: Move to DataTransferData framework
    object.addDataTransferData(dataTransfer);

    // At this time, we don't support dragging multiple items
    objects.selectOnly(object);

    // Do not bubble as tab drag event
    $event.stopPropagation();
  }

  openParentEditDialog(parent) {
    return this.actions.openEditDialog(parent).then(
      () => {
        this.snackBar.open(`Saved changes to ${getObjectLabel(parent)}.`, 'Close', {
          duration: 5000,
        });
      },
      () => {}
    );
  }

  openObject(target: FilesystemObject, appLinks?: boolean | WorkspaceNavigationExtras) {
    this.objectOpen.emit(target);

    if (appLinks) {
      if (target.isOpenable) {
        // TODO: Normally this would just be handled by the `appLink` directive. Really, we should update the template to either:
        //  - Use appLink
        //  - Use a callback that does the download portion of the `else` block below
        openInternalLink(
          this.workspaceManager,
          toValidUrl(this.router.createUrlTree(target.getCommands()).toString()),
          _merge({ newTab: !target.isDirectory }, appLinks)
        );
      } else {
        const progressDialogRef = this.progressDialog.display({
          title: `Download ${getObjectLabel(target)}`,
          progressObservables: [
            new BehaviorSubject<Progress>(
              new Progress({
                status: 'Generating download...',
              })
            ),
          ],
        });
        this.filesystemService
          .getContent(target.hashId)
          .pipe(
            map((blob) => {
              return new File([blob], target.filename);
            }),
            tap((file) => {
              openDownloadForBlob(file, file.name);
            }),
            finalize(() => progressDialogRef.close()),
            this.errorHandler.create({ label: 'Download file' })
          )
          .subscribe();
      }
    }
  }

  updateView(objects: CollectionModel<FilesystemObject>) {
    objects.updateView();
  }

  toggleStarred(object: FilesystemObject, objects: CollectionModel<FilesystemObject>) {
    this.filesystemService
      .updateStarred(object.hashId, isNil(object.starred))
      .toPromise()
      .then((result) => {
        object.update(result);
        this.updateView(objects);
      });
  }
}
