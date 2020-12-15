import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProjectImpl } from '../../models/filesystem-object';

@Component({
  selector: 'app-project-collaborators-dialog',
  templateUrl: './project-collaborators-dialog.component.html',
})
export class ProjectCollaboratorsDialogComponent extends CommonFormDialogComponent<any> {
  private _project: ProjectImpl;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get project() {
    return this._project;
  }

  @Input()
  set project(value: ProjectImpl) {
    this._project = value;
  }

  getValue(): any {
  }
}
