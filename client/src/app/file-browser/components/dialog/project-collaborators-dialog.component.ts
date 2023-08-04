import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { uniqueId } from 'lodash-es';
import { finalize, tap } from 'rxjs/operators';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { ModelList } from 'app/shared/models';
import { nonEmptyList } from 'app/shared/validators';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { AppUser } from 'app/interfaces';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { addStatus } from 'app/shared/pipes/add-status.pipe';
import { collaboratorLoadingMock } from 'app/shared/mocks/loading/user';
import { mockArrayOf } from 'app/shared/mocks/loading/utils';

import { ProjectImpl } from '../../models/filesystem-object';
import { Collaborator } from '../../models/collaborator';
import { ProjectsService } from '../../services/projects.service';
import { MultiCollaboratorUpdateRequest } from '../../schema';

@Component({
  selector: 'app-project-collaborators-dialog',
  templateUrl: './project-collaborators-dialog.component.html',
})
export class ProjectCollaboratorsDialogComponent extends CommonFormDialogComponent<void> {
  id = uniqueId('ProjectCollaboratorsDialogComponent-');

  private _project: ProjectImpl;
  collaborators$: Subject<ModelList<Collaborator>> = new Subject<ModelList<Collaborator>>();
  collaboratorsWithStatus$ = this.collaborators$.pipe(
    addStatus(new ModelList(mockArrayOf(collaboratorLoadingMock)))
  );
  readonly addForm: FormGroup = new FormGroup({
    roleName: new FormControl('project-read', Validators.required),
    users: new FormControl([], nonEmptyList),
  });

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    protected readonly modalService: NgbModal,
    protected readonly projectsService: ProjectsService,
    protected readonly progressDialog: ProgressDialog,
    protected readonly errorHandler: ErrorHandler
  ) {
    super(modal, messageDialog);
  }

  get project() {
    return this._project;
  }

  @Input()
  set project(value: ProjectImpl) {
    this._project = value;
    this.refresh();
  }

  getValue() {}

  refresh() {
    this.projectsService
      .getCollaborators(this.project.hashId, {
        limit: 100, // TODO: Implement pagination
      })
      .subscribe((result) => this.collaborators$.next(result));
  }

  addCollaborator() {
    if (!this.addForm.invalid) {
      const roleName: string = this.addForm.value.roleName;
      const users: AppUser[] = this.addForm.value.users;
      const request: MultiCollaboratorUpdateRequest = {
        updateOrCreate: users.map((user) => ({
          userHashId: user.hashId,
          roleName,
        })),
      };

      this.saveCollaborators(request)
        .pipe(this.errorHandler.createFormErrorHandler(this.addForm))
        .subscribe();
    } else {
      this.addForm.markAsDirty();
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }

  removeCollaborator(collaborator: Collaborator) {
    this.saveCollaborators({
      removeUserHashIds: [collaborator.user.hashId],
    }).subscribe();
  }

  changeCollaboratorRole(collaborator: Collaborator, roleName: string) {
    this.saveCollaborators({
      updateOrCreate: [
        {
          userHashId: collaborator.user.hashId,
          roleName,
        },
      ],
    }).subscribe();
  }

  private saveCollaborators(
    request: MultiCollaboratorUpdateRequest
  ): Observable<ModelList<Collaborator>> {
    const progressDialogRef = this.progressDialog.display({
      title: 'Updating Collaborators',
      progressObservables: [
        new BehaviorSubject<Progress>(
          new Progress({
            status: 'Updating collaborators',
          })
        ),
      ],
    });

    return this.projectsService.saveCollaborators(this.project.hashId, request).pipe(
      tap((collaborators) => {
        this.addForm.patchValue({
          users: [],
        });
        this.addForm.markAsPristine();
        this.collaborators$.next(collaborators);
      }),
      finalize(() => progressDialogRef.close()),
      this.errorHandler.create({ label: 'Save project collaborators' })
    );
  }
}
