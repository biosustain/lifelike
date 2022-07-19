import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { Subscription, throwError, iif, of, ReplaySubject, merge, defer } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { map, switchMap, tap, first } from 'rxjs/operators';

import { CreateActionOptions, CreateDialogAction } from 'app/file-types/providers/base-object.type-provider';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { RankedItem } from 'app/shared/schemas/common';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { Source } from 'app/drawing-tool/services/interfaces';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { getObjectLabel } from '../utils/objects';
import { ProjectsService } from '../services/projects.service';

@Component({
  selector: 'app-object-browser',
  templateUrl: './object-browser.component.html',
})
export class ObjectBrowserComponent implements ModuleAwareComponent {
  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly projectService: ProjectsService,
              protected readonly filesystemService: FilesystemService,
              protected readonly actions: FilesystemObjectActions,
              protected readonly objectTypeService: ObjectTypeService) {
  }

  createActions$ = this.objectTypeService.all().pipe(
    map(providers => {
      const createActions: RankedItem<CreateDialogAction>[] = [].concat(
        ...providers.map(provider => provider.getCreateDialogOptions()),
      );
      createActions.sort((a, b) => a.rank > b.rank ? -1 : (a.rank < b.rank ? 1 : 0));
      return createActions.map(item => item.item);
    }),
  );

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  protected _hashId$ = new ReplaySubject<string>(1);
  protected hashId$ = merge(
    this._hashId$,
    this.route.params.pipe(
      switchMap(({dir_id, project_name}) =>
        iif(
          () => dir_id,
          of(dir_id),
          // Legacy URLs use the project name (which we are deprecating) so
          // we need to figure out what that requested project is
          this.projectService.search({
            name: project_name,
          }).pipe(
            this.errorHandler.create({label: 'Load project from name for legacy URL'}),
            switchMap(({results}) =>
              iif(
                () => Boolean(results.length),
                results.items$.pipe(
                  map(([item]) => item.root.hashId)
                ),
                throwError(new HttpErrorResponse({
                  status: 404,
                }))
              )
            )
          )
        )
      )
    )
  );

  protected subscriptions = new Subscription();
  protected annotationSubscription: Subscription;

  object$ = this.hashId$.pipe(
    switchMap(hashId => this.filesystemService.get(hashId).pipe(
      tap(object =>
        this.modulePropertiesChange.emit({
          title: object.isDirectory && !object.parent ? object.project.name
            : `${object.project.name} - ${object.filename}`,
          fontAwesomeIcon: 'folder',
        })
      ))
    )
  );

  sourceData$ = defer(() => this.object$.pipe(
    tap(object => console.log(object)),
    switchMap(object => iif(() => (object.isDirectory && !object.parent),
      of([{
        url: `/projects/${object.project.name}`,
        domain: object.project.name,
      } as Source]),
      of(object.getGraphEntitySources())
    ))
  ));

  load(hashId: string) {
    this._hashId$.next(hashId);
  }

  refresh() {
    return this.hashId$.pipe(
      first(),
      tap(hashId => this._hashId$.next(hashId))
    ).toPromise();
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
      } as MessageArguments);
      return false;
    } else {
      return true;
    }
  }

  openUploadDialog(parent: FilesystemObject) {
    return this.actions.openUploadDialog(parent).then(object => {
      this.snackBar.open(`${getObjectLabel(object)} successfully uploaded.`, 'Close', {
        duration: 5000,
      });
      return this.refresh();
    });
  }

  reannotate(targets: FilesystemObject[]) {
    return this.actions.reannotate(targets).then(() => this.refresh());
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
      return this.refresh();
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
      this.refresh();
    }, () => {
    });
  }

  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(), {
      queryParams: this.getObjectQueryParams(target),
      newTab: target.type !== 'dir',
    });
  }

  runCreateAction(action: CreateDialogAction, options: CreateActionOptions) {
    return action.create(options).then(object => {
      this.snackBar.open(`${getObjectLabel(object)} created.`, 'Close', {
        duration: 5000,
      });
      this.refresh();
      if (action.openSuggested) {
        this.workspaceManager.navigate(object.getCommands(), {
          newTab: true,
        });
      }
    }, () => {
    });
  }

  isSelectionAnnotatable(selection: FilesystemObject[]) {
    for (const object of selection) {
      if (object.isAnnotatable) {
        return true;
      }
    }
    return false;
  }

  isSelectionMovable(selection: FilesystemObject[]) {
    for (const object of selection) {
      if (object.isMovable) {
        return true;
      }
    }
    return false;
  }

  isSelectionDeletable(selection: FilesystemObject[]) {
    for (const object of selection) {
      if (object.isDeletable) {
        return true;
      }
    }
    return false;
  }
}
