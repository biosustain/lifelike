import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ProjectSpaceService } from '../services/project-space.service';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { catchError } from 'rxjs/operators';
import { EMPTY, throwError } from 'rxjs';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './project-create-dialog.component.html',
})
export class ProjectCreateDialogComponent extends CommonDialogComponent {
  form: FormGroup = new FormGroup({
    projectName: new FormControl('', Validators.required),
    description: new FormControl(''),
  });

  errors = {
    duplicateProjectName: 'A project with that name already exists.',
  };

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              private readonly projectSpaceService: ProjectSpaceService,
              private readonly errorHandler: ErrorHandler) {
    super(modal, messageDialog);
  }

  get transformedName(): string {
    return this.form.value.projectName.replace(/[^A-Za-z0-9-]/g, '-');
  }

  getValue() {
    return {
      ...this.form.value,
    };
  }

  submit(): void {
    if (!this.form.invalid) {
      this.projectSpaceService.createProject({
        ...this.form.value,
        projectName: this.transformedName,
      }).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 400 && error.error.apiHttpError && error.error.apiHttpError.name === 'Duplicate record') {
            this.form.get('projectName').setErrors({duplicateProjectName: true});
            return EMPTY;
          } else {
            return throwError(error);
          }
        }),
        this.errorHandler.create(),
      ).subscribe(newProject => this.modal.close(newProject));
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
}
