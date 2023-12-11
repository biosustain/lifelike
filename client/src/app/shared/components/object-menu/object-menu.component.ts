import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';

import { cloneDeep } from 'lodash-es';
import { ReplaySubject, Subject } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { getObjectLabel } from 'app/file-browser/utils/objects';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { AuthenticationService } from 'app/auth/services/authentication.service';

@Component({
  selector: 'app-object-menu',
  templateUrl: './object-menu.component.html',
})
export class ObjectMenuComponent implements OnInit, OnChanges {
  encodeURIComponent = encodeURIComponent;

  @Input() object: FilesystemObject;
  @Input() forEditing = true;
  @Input() nameEntity = false;
  @Input() showOpen = true;
  @Input() showRestore = false;
  @Input() showDelete = false;
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();
  @Output() objectRefresh = new EventEmitter<FilesystemObject>();
  @Output() objectRestore = new EventEmitter<ObjectVersion>();
  @Output() objectUpdate = new EventEmitter<FilesystemObject>();
  private readonly object$: Subject<FilesystemObject> = new ReplaySubject(1);

  constructor(
    readonly router: Router,
    protected readonly snackBar: MatSnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly route: ActivatedRoute,
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly actions: FilesystemObjectActions,
    protected readonly objectTypeService: ObjectTypeService,
    protected readonly authService: AuthenticationService
  ) {}

  ngOnChanges({ object }: SimpleChanges) {
    if (object && !object.firstChange) {
      this.object$.next(object.currentValue);
    }
  }

  ngOnInit() {
    this.object$.next(this.object);
  }

  openEditDialog(target: FilesystemObject) {
    return this.actions
      .openEditDialog(target)
      .then((value) =>
        this.snackBar.open(`Saved changes to ${getObjectLabel(target)}.`, 'Close', {
          duration: 5000,
        })
      )
      .then(() => this.objectUpdate.emit(target));
  }

  openCloneDialog(target: FilesystemObject) {
    const newTarget: FilesystemObject = cloneDeep(target);
    newTarget.public = false;
    return this.actions
      .openCloneDialog(newTarget)
      .then((clone) =>
        this.snackBar.open(
          `Copied ${getObjectLabel(target)} to ${getObjectLabel(clone)}.`,
          'Close',
          { duration: 5000 }
        )
      )
      .then(() => this.refreshRequest.emit());
  }

  openMoveDialog(targets: FilesystemObject[]) {
    return this.actions
      .openMoveDialog(targets)
      .then(({ destination }) =>
        this.snackBar.open(
          `Moved ${getObjectLabel(targets)} to ${getObjectLabel(destination)}.`,
          'Close',
          { duration: 5000 }
        )
      )
      .then(() => this.refreshRequest.emit());
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions
      .openDeleteDialog(targets)
      .then(() =>
        this.snackBar.open(`Deleted ${getObjectLabel(targets)}.`, 'Close', { duration: 5000 })
      )
      .then(() => this.refreshRequest.emit());
  }

  reannotate(targets: FilesystemObject[]) {
    return this.actions
      .reannotate(targets)
      .then(() =>
        this.snackBar.open(`${getObjectLabel(targets)} re-annotated.`, 'Close', { duration: 5000 })
      )
      .then(() => this.refreshRequest.emit())
      .then(() => this.objectRefresh.emit());
  }

  openVersionHistoryDialog(target: FilesystemObject) {
    return this.actions.openVersionHistoryDialog(target);
  }

  openVersionRestoreDialog(target: FilesystemObject) {
    return this.actions.openVersionRestoreDialog(target).then(
      (version) => {
        this.objectRestore.emit(version);
      },
      () => {}
    );
  }

  openShareDialog(target: FilesystemObject) {
    return this.actions.openShareDialog(target, false);
  }

  openLink(url: string) {
    window.open(url);
  }

  updateStarred(hashId: string, starred: boolean) {
    return this.actions.updateStarred(hashId, starred).then((result) => {
      this.object.update(result);
      this.objectUpdate.emit(this.object);
    });
  }

  updatePinned(target: FilesystemObject) {
    return this.actions.updatePinned(target).then(() => this.objectUpdate.emit(this.object));
  }
}
