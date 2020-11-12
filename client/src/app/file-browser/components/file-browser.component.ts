import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { from, Observable, Subscription } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { WorkspaceManager } from '../../shared/workspace-manager';
import { ModuleProperties } from '../../shared/modules';
import { FilesystemObject, PathLocator } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { map } from 'rxjs/operators';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';

@Component({
  selector: 'app-file-browser',
  templateUrl: './file-browser.component.html',
})
export class FileBrowserComponent implements OnInit, OnDestroy {
  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  annotationSubscription: Subscription;
  object$: Observable<FilesystemObject> = from([]);
  paramsSubscription: Subscription;

  projectName: string;

  constructor(readonly router: Router,
              readonly snackBar: MatSnackBar,
              readonly modalService: NgbModal,
              readonly errorHandler: ErrorHandler,
              readonly route: ActivatedRoute,
              readonly workspaceManager: WorkspaceManager,
              readonly filesystemService: FilesystemService,
              readonly actions: FilesystemObjectActions) {
  }

  ngOnInit() {
    this.paramsSubscription = this.route.params.subscribe(params => {
      this.projectName = params.project_name;

      this.modulePropertiesChange.emit({
        title: this.projectName,
        fontAwesomeIcon: 'layer-group',
      });

      this.load({
        projectName: params.project_name,
        directoryId: params.dir_id,
      });
    });
  }

  ngOnDestroy(): void {
    if (this.annotationSubscription) {
      this.annotationSubscription.unsubscribe();
      this.annotationSubscription = null;
    }
    this.paramsSubscription.unsubscribe();
  }

  load(locator: PathLocator): Observable<any> {
    const object$ = this.filesystemService.get({
      projectName: locator.projectName,
      directoryId: locator.directoryId,
    }).pipe(map(object => {
      if (this.annotationSubscription) {
        this.annotationSubscription.unsubscribe();
        this.annotationSubscription = null;
      }
      this.annotationSubscription = this.filesystemService.annotate(object);
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

  openDirectoryCreateDialog(parent: FilesystemObject) {
    return this.actions.openDirectoryCreateDialog(parent).then(() => {
      this.snackBar.open(`Directory created.`, 'Close', {
        duration: 5000,
      });
      this.load(parent.locator);
    }, () => {
    });
  }

  openMapCreateDialog(parent: FilesystemObject) {
    return this.actions.openMapCreateDialog(parent).then(() => {
      this.snackBar.open(`Map created.`, 'Close', {
        duration: 5000,
      });
      this.load(parent.locator);
    }, () => {
    });
  }

  openEnrichmentTableCreateDialog(parent: FilesystemObject) {
    return this.actions.openEnrichmentTableCreateDialog(parent).then(() => {
      this.snackBar.open(`Enrichment table created.`, 'Close', {
        duration: 5000,
      });
      this.load(parent.locator);
    }, () => {
    });
  }

  openUploadDialog(parent: FilesystemObject) {
    return this.actions.openUploadDialog(parent).then(() => {
      this.snackBar.open(`File saved to folder.`, 'Close', {
        duration: 5000,
      });
      this.load(parent.locator);
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deletion successful.`, 'Close', {
        duration: 5000,
      });
      this.load(targets[0].locator);
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`Selected files re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.load(targets[0].locator);
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
