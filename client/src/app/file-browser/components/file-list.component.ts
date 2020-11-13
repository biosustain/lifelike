import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FilesystemObject } from '../models/filesystem-object';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { nullCoalesce } from '../../shared/utils/types';
import { uniqueId } from 'lodash';
import { getObjectLabel } from '../utils/objects';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
})
export class FileListComponent {
  id = uniqueId('FileListComponent-');

  @Input() appLinks: false;
  @Input() parent: FilesystemObject;
  @Input() objectControls = true;
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';
  @Output() hashIdChange = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();

  constructor(readonly router: Router,
              readonly snackBar: MatSnackBar,
              readonly modalService: NgbModal,
              readonly errorHandler: ErrorHandler,
              readonly route: ActivatedRoute,
              readonly workspaceManager: WorkspaceManager,
              readonly actions: FilesystemObjectActions) {
  }

  dragStarted(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);
  }

  openEditDialog(target: FilesystemObject) {
    return this.actions.openEditDialog(target).then(() => {
      this.snackBar.open(`Saved changes to ${getObjectLabel(target)}.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }

  openCloneDialog(target: FilesystemObject) {
    return this.actions.openCloneDialog(target).then(clone => {
      this.snackBar.open(`Copied ${getObjectLabel(target)} to ${getObjectLabel(clone)}.`, 'Close', {
        duration: 5000,
      });
      this.hashIdChange.next(this.parent.hashId);
    }, () => {
    });
  }

  openMoveDialog(targets: FilesystemObject[]) {
    return this.actions.openMoveDialog(targets).then(({destination}) => {
      this.snackBar.open(
        `Moved ${getObjectLabel(targets)} to ${getObjectLabel(destination)}.`,
        'Close', {
          duration: 5000,
        });
      this.hashIdChange.next(this.parent.hashId);
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deleted ${getObjectLabel(targets)}.`, 'Close', {
        duration: 5000,
      });
      this.hashIdChange.next(this.parent.hashId);
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`${getObjectLabel(targets)} re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.hashIdChange.next(this.parent.hashId);
    }, () => {
    });
  }

  download(target: FilesystemObject) {
    this.actions.openDownloadDialog(target).then(() => {
      this.snackBar.open(`File download of ${getObjectLabel(target)} opened.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }

  getDateShown(object: DirectoryObject) {
    return nullCoalesce(object.modificationDate, object.creationDate);
  }
}
