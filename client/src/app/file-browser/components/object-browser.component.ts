import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { from, Observable, Subscription, throwError } from 'rxjs';
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
import { ProjectsService } from '../services/projects.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-object-browser',
  templateUrl: './object-browser.component.html',
})
export class ObjectBrowserComponent implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  protected hashId: string;
  protected subscriptions = new Subscription();
  protected annotationSubscription: Subscription;
  object$: Observable<FilesystemObject> = from([]);

  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly projectService: ProjectsService,
              protected readonly filesystemService: FilesystemService,
              protected readonly actions: FilesystemObjectActions) {
  }

  ngOnInit() {
    this.subscriptions.add(this.route.params.subscribe(params => {
      if (params.dir_id) {
        this.load(params.dir_id);
      } else {
        // Legacy URLs use the project name (which we are deprecating) so
        // we need to figure out what that requested project is
        this.projectService.search({
          name: params.project_name,
        }).pipe(
          this.errorHandler.create(),
        ).subscribe(list => {
          if (list.results.length) {
            this.load(list.results.items[0].***ARANGO_USERNAME***.hashId);
          } else {
            this.object$ = throwError(new HttpErrorResponse({
              status: 404,
            }));
          }
        });
      }
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
      this.modulePropertiesChange.emit({
        title: object.isDirectory && !object.parent ? object.project.name
          : `${object.project.name} - ${object.filename}`,
        fontAwesomeIcon: 'folder',
      });
      return object;
    }));
    this.object$ = object$;
    return object$;
  }

  refresh() {
    this.load(this.hashId);
  }

  applyFilter(object: FilesystemObject, filter: string) {
    object.filterChildren(filter);
  }

  goUp(object: FilesystemObject) {
    if (object.parent) {
      this.workspaceManager.navigate(object.parent.getCommands());
    } else {
      this.workspaceManager.navigate(['/projects']);
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
    return this.actions.openDirectoryCreateDialog(parent).then(object => {
      this.snackBar.open(`Directory ${getObjectLabel(object)} created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openMapCreateDialog(parent: FilesystemObject) {
    return this.actions.openMapCreateDialog({
      parent,
    }).then(object => {
      this.snackBar.open(`Map ${getObjectLabel(object)} created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openEnrichmentTableCreateDialog(parent: FilesystemObject) {
    return this.actions.openEnrichmentTableCreateDialog(parent).then(object => {
      this.snackBar.open(`Enrichment table ${getObjectLabel(object)} created.`, 'Close', {
        duration: 5000,
      });
      this.load(this.hashId);
    }, () => {
    });
  }

  openUploadDialog(parent: FilesystemObject) {
    return this.actions.openUploadDialog(parent).then(object => {
      this.snackBar.open(`${getObjectLabel(object)} successfully uploaded.`, 'Close', {
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

  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(), {
      queryParams: this.getObjectQueryParams(target),
      newTab: target.type !== 'dir',
    });
  }

}
