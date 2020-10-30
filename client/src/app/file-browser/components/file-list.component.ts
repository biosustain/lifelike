import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { DirectoryObject } from '../../interfaces/projects.interface';
import { nullCoalesce } from '../../shared/utils/types';
import { uniqueId } from 'lodash';

@Component({
  selector: 'app-file-list',
  templateUrl: './file-list.component.html',
})
export class FileListComponent {
  id = uniqueId('FileListComponent-');

  @Input() parent: FilesystemObject;
  @Input() objectControls = true;
  @Output() locatorChange = new EventEmitter<PathLocator>();
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
      this.snackBar.open(`File changes saved.`, 'Close', {
        duration: 5000,
      });
      this.locatorChange.next(this.parent.locator);
    }, () => {
    });
  }

  openEnrichmentTableEditDialog(target: FilesystemObject) {
    return this.actions.openEnrichmentTableEditDialog(target).then(() => {
      this.snackBar.open(`Changes saved.`, 'Close', {
        duration: 5000,
      });
      this.locatorChange.next(this.parent.locator);
    }, () => {
    });
  }

  openMoveDialog(target: FilesystemObject) {
    return this.actions.openMoveDialog(target).then(() => {
      this.snackBar.open(`File moved.`, 'Close', {
        duration: 5000,
      });
      this.locatorChange.next(this.parent.locator);
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deletion successful.`, 'Close', {
        duration: 5000,
      });
      this.locatorChange.next(this.parent.locator);
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`Selected files re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.locatorChange.next(this.parent.locator);
    }, () => {
    });
  }

  getDateShown(object: DirectoryObject) {
    return nullCoalesce(object.modificationDate, object.creationDate);
  }
}
