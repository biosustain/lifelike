import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProjectImpl } from '../../models/filesystem-object';
import { ModalList } from '../../../shared/models';
import { Collaborator } from '../../models/collaborator';
import { Observable, of } from 'rxjs';
import { ProjectsService } from '../../services/projects.service';
import { uniqueId } from 'lodash';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-project-collaborators-dialog',
  templateUrl: './project-collaborators-dialog.component.html',
})
export class ProjectCollaboratorsDialogComponent extends CommonFormDialogComponent<any> {
  id = uniqueId('ProjectCollaboratorsDialogComponent-');

  private _project: ProjectImpl;
  collaborators$: Observable<ModalList<Collaborator>> = of(new ModalList<Collaborator>());
  readonly addForm: FormGroup = new FormGroup({
    roleName: new FormControl('project-read'),
    users: new FormControl([]),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal,
              protected readonly projectsService: ProjectsService) {
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

  getValue(): any {
  }

  refresh() {
    this.collaborators$ = this.projectsService.getCollaborators(this.project.hashId, {
      limit: 100, // TODO: Implement pagination
    });
  }

  removeCollaborator(collaborator: Collaborator) {
  }

  addCollaborator() {
  }

  changeCollaboratorRole(collaborator: Collaborator, role: string) {

  }
}
