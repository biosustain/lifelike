import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { from, Observable, Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { ModuleProperties } from '../../shared/modules';
import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { map } from 'rxjs/operators';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { getObjectLabel } from '../utils/objects';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  protected hashId: string;
  protected subscriptions = new Subscription();
  protected annotationSubscription: Subscription;
  object$: Observable<FilesystemObject> = from([]);

  constructor(readonly router: Router,
              readonly snackBar: MatSnackBar,
              readonly modalService: NgbModal,
              readonly messageDialog: MessageDialog,
              readonly errorHandler: ErrorHandler,
              readonly route: ActivatedRoute,
              readonly workspaceManager: WorkspaceManager,
              readonly filesystemService: FilesystemService,
              readonly actions: FilesystemObjectActions) {
  }

  ngOnInit() {
    this.subscriptions.add(this.route.params.subscribe(params => {
      this.load(params.dir_id);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  load(hashId: string): Observable<any> {
    this.hashId = hashId;
    const object$ = this.filesystemService.get(hashId).pipe(map(object => {
      if (this.annotationSubscription) {
        this.subscriptions.remove(this.annotationSubscription);
        this.annotationSubscription.unsubscribe();
        this.annotationSubscription = null;
      }
      this.annotationSubscription = this.filesystemService.annotate(object);
      this.subscriptions.add(this.annotationSubscription);
      return object;
    }));
    this.object$ = object$;
    return object$;
  }

  applyFilter(object: FilesystemObject, filter: string) {
    object.filterChildren(filter);
  }

  goUp(object: FilesystemObject) {
    if (object.path != null) {
      if (object.path.length > 2) {
        this.workspaceManager.navigate(
          ['/projects', object.locator.projectName, 'folders',
            object.path[object.path.length - 2].id],
        );
      } else if (object.path.length === 2) {
        this.workspaceManager.navigate(
          ['/projects', object.locator.projectName],
        );
      } else {
        this.workspaceManager.navigate(['/projects']);
      }
    }
  }

  getObjectQueryParams(object: FilesystemObject) {
    if (this.router.url === this.workspaceManager.workspaceUrl) {
      return {};
    } else {
      return {
        return: `/projects/${encodeURIComponent(object.locator.projectName)}`
          + (object.locator.directoryId ? `/folders/${object.locator.directoryId}` : ''),
      };
    }
  }

  // ========================================
  // Template
  // ========================================

  selectionExists(targets: FilesystemObject[]) {
    if (!targets.length) {
      this.messageDialog.display({
        title: 'Nothing Selected',
        message: 'Select at least one item.',
        type: MessageType.Error,
      });
      return false;
    } else {
      return true;
    }
  }

  openDirectoryCreateDialog(parent: FilesystemObject) {
    return this.actions.openDirectoryCreateDialog(parent).then(() => {
      this.snackBar.open(`Directory created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openMapCreateDialog(parent: FilesystemObject) {
    return this.actions.openMapCreateDialog(parent).then(() => {
      this.snackBar.open(`Map created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openEnrichmentTableCreateDialog(parent: FilesystemObject) {
    return this.actions.openEnrichmentTableCreateDialog(parent).then(() => {
      this.snackBar.open(`Enrichment table created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openUploadDialog(parent: FilesystemObject) {
    return this.actions.openUploadDialog(parent).then(() => {
      this.snackBar.open(`File saved to folder.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`Selected files re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openMoveDialog(targets: FilesystemObject[]) {
    if (!this.selectionExists(targets)) {
      return;
    }

    return this.actions.openMoveDialog(targets).then(({destination}) => {
      this.snackBar.open(
        `Moved ${getObjectLabel(targets)} to ${getObjectLabel(destination)}.`,
        'Close', {
          duration: 5000,
        });
      this.load(this.hashId);
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    if (!this.selectionExists(targets)) {
      return;
    }

    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deletion successful.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openEntityCloudPane() {
    const url = `/entity-cloud/${this.projectName}`;
    this.workspaceManager.navigateByUrl(url, {sideBySide: true, newTab: true});
  }

  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(), {
      queryParams: this.getObjectQueryParams(target),
      newTab: target.type !== 'dir',
    });
  }
}
