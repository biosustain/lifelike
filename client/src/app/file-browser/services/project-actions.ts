import { Injectable } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of, throwError, iif, defer } from 'rxjs';
import { finalize, catchError, map, switchMap, tap, first } from 'rxjs/operators';
import { Store, select } from '@ngrx/store';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { DeleteNonEmpty } from 'app/shared/exceptions';
import { wrapExceptions } from 'app/shared/rxjs/wrapExceptions';
import { State } from 'app/***ARANGO_USERNAME***-store';
import { AuthSelectors } from 'app/auth/store';
import { ClipboardService } from 'app/shared/services/clipboard.service';
import { DirectoryObject } from 'app/interfaces/projects.interface';

import { ProjectsService } from './projects.service';
import { ProjectImpl } from '../models/filesystem-object';
import { ProjectEditDialogComponent, ProjectEditDialogValue } from '../components/dialog/project-edit-dialog.component';
import { ProjectCreateRequest } from '../schema';
import { ProjectCollaboratorsDialogComponent } from '../components/dialog/project-collaborators-dialog.component';
import { ObjectDeleteDialogComponent } from '../components/dialog/object-delete-dialog.component';
import { ObjectDeleteReqursiveDialogComponent } from '../components/dialog/object-delete-reqursive-dialog.component';

@Injectable()
export class ProjectActions {
  constructor(
    private readonly store: Store<State>,
    protected readonly projectService: ProjectsService,
    protected readonly modalService: NgbModal,
    protected readonly messageDialog: MessageDialog,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly clipboard: ClipboardService) {
  }


  isAdmin$ = this.store.pipe(
    select(AuthSelectors.selectRoles),
    map(roles => roles.includes('admin'))
  );

  addSimpleProgressDialog(message: string, title = 'Working...') {
    const progressDialogRef = this.progressDialog.display({
      title,
      progressObservables: [
        of(new Progress({status: message}))
      ],
    });
    return observable => observable.pipe(
      finalize(() => progressDialogRef.close()),
    );
  }

  /**
   * Open a dialog to create a project.
   */
  openCreateDialog(options: CreateDialogOptions = {}): Promise<ProjectImpl> {
    const project = new ProjectImpl();
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New Project';
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) =>
        this.addSimpleProgressDialog('Creating project...')(
          this.projectService.create({
            ...value.request,
            ...(options.request || {}),
          })
        ).pipe(
          this.errorHandler.create({label: 'Create project'}),
        ).toPromise()
    );
    return dialogRef.result;
  }

  /**
   * Open a dialog to edit a project.
   * @param project the project to edit
   */
  openEditDialog(project: ProjectImpl): Promise<ProjectImpl> {
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) =>
        this.addSimpleProgressDialog(`Saving changes to '${project.name}'...`)(
          this.projectService.save([project.hashId], value.request, {
            [project.hashId]: project,
          })
        ).pipe(
          this.errorHandler.create({label: 'Edit project'}),
        ).toPromise()
    );
    return dialogRef.result;
  }

  /**
   * Open a dialog to modify a project's collaborators.
   * @param project the project to edit
   */
  openCollaboratorsDialog(project: ProjectImpl): Promise<void> {
    const dialogRef = this.modalService.open(ProjectCollaboratorsDialogComponent);
    dialogRef.componentInstance.project = project;
    return dialogRef.result;
  }

  /**
   * Open a dialog to delete a project.
   * @param project the project to delete
   */
  openDeleteDialog(project: ProjectImpl): Promise<DirectoryObject[]> {
    const dialogRef = this.modalService.open(ObjectDeleteDialogComponent);
    dialogRef.componentInstance.objects = [project];
    dialogRef.componentInstance.accept = () =>
      this.addSimpleProgressDialog(`Deleting ${project.name}...`)(
        this.projectService.delete(project.hashId)
      ).pipe(
        wrapExceptions,
        catchError(err =>
          iif(
            () => err instanceof DeleteNonEmpty,
            this.isAdmin$.pipe(
              first(),
              switchMap(isAdmin =>
                iif(
                  () => isAdmin,
                  defer(() =>
                    this.modalService.open(ObjectDeleteReqursiveDialogComponent).result.then(
                      () => this.projectService
                        .delete(project.hashId, undefined, true)
                        .pipe(wrapExceptions),
                      () => of(false)
                    )
                  ).pipe(
                    switchMap(nextStep$ => nextStep$)
                  ),
                  throwError(err)
                )
              )
            ),
            throwError(err)
          )
        ),
        this.errorHandler.create({label: 'Delete project'}),
        tap(deleted => deleted ? dialogRef.close() : dialogRef.dismiss())
      ).toPromise();
    return dialogRef.result;
  }

  openShareDialog(project: ProjectImpl): Promise<boolean> {
    return Promise.resolve(
      this.clipboard.copy(`${window.location.origin}/${project.getURL()}`),
    );
  }
}

export class CreateDialogOptions {
  title?: string;
  request?: Partial<ProjectCreateRequest>;
}
