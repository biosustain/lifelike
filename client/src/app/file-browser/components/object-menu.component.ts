import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FilesystemObject} from '../models/filesystem-object';
import {getObjectLabel} from '../utils/objects';
import {ActivatedRoute, Router} from '@angular/router';
import {MatSnackBar} from '@angular/material/snack-bar';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {ErrorHandler} from '../../shared/services/error-handler.service';
import {WorkspaceManager} from '../../shared/workspace-manager';
import {FilesystemObjectActions} from '../services/filesystem-object-actions';
import {cloneDeep} from 'lodash';
import {ObjectVersion} from '../models/object-version';

@Component({
  selector: 'app-object-menu',
  templateUrl: './object-menu.component.html',
})
export class ObjectMenuComponent {

  @Input() object: FilesystemObject;
  @Input() forEditing = true;
  @Input() nameEntity = false;
  @Input() showOpen = true;
  @Input() showRestore = false;
  @Input() showDelete = false;
  @Input() showTools = true;
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();
  @Output() objectRefresh = new EventEmitter<FilesystemObject>();
  @Output() objectRestore = new EventEmitter<ObjectVersion>();

  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions) {
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
    const newTarget: FilesystemObject = cloneDeep(target);
    newTarget.public = false;
    return this.actions.openCloneDialog(newTarget).then(clone => {
      this.snackBar.open(`Copied ${getObjectLabel(target)} to ${getObjectLabel(clone)}.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
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
      this.refreshRequest.next();
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deleted ${getObjectLabel(targets)}.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    return this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`${getObjectLabel(targets)} re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
      this.objectRefresh.next();
    }, () => {
    });
  }

  openVersionHistoryDialog(target: FilesystemObject) {
    return this.actions.openVersionHistoryDialog(target);
  }

  openVersionRestoreDialog(target: FilesystemObject) {
    return this.actions.openVersionRestoreDialog(target).then(version => {
      this.objectRestore.next(version);
    }, () => {
    });
  }

  openExportDialog(target: FilesystemObject) {
    return this.actions.openExportDialog(target);
  }

  openShareDialog(target: FilesystemObject) {
    return this.actions.openShareDialog(target, false);
  }

}
