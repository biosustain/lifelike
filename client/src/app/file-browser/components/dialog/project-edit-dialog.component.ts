import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

import { ProjectImpl } from '../../models/filesystem-object';
import { ProjectCreateRequest } from '../../schema';

@Component({
  selector: 'app-project-edit-dialog',
  templateUrl: './project-edit-dialog.component.html',
})
export class ProjectEditDialogComponent extends CommonFormDialogComponent<ProjectEditDialogValue> {
  @Input() title = 'Edit Project';

  private _project: ProjectImpl;

  readonly form: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]+$/)]),
    description: new FormControl(),
  });

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
    this.form.patchValue({
      name: value.name || '',
      description: value.description || '',
    });
  }

  applyValue(value: ProjectEditDialogValue) {
    Object.assign(this.project, value.projectChanges);
  }

  getValue(): ProjectEditDialogValue {
    const value = this.form.value;

    const projectChanges = {
      name: value.name,
      description: value.description,
    };

    const request: ProjectCreateRequest = {
      name: value.name,
      description: value.description,
    };

    return {
      project: this.project,
      projectChanges,
      request,
    };
  }
}

export interface ProjectEditDialogValue {
  project: ProjectImpl;
  projectChanges: Partial<ProjectImpl>;
  request: ProjectCreateRequest;
}
