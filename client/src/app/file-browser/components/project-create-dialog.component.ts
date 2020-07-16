import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ProjectSpaceService } from 'app/file-browser/services/project-space.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './project-create-dialog.component.html'
})
export class ProjectCreateDialogComponent extends CommonFormDialogComponent implements OnInit, OnDestroy {
  form: FormGroup = new FormGroup({
    projectName: new FormControl('', Validators.required),
    description: new FormControl('')
  });

  subscription: Subscription;

  errors = {
    duplicateProjectName: 'A project with that name already exists'
  };

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    private projSpace: ProjectSpaceService
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {
    this.subscription = this.form.valueChanges.subscribe(
      () => {}
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  getValue() {
    return this.form.value;
  }

  submit() {
    if (this.form.valid) {
      this.projSpace.createProject(this.getValue())
        .subscribe(
          newProject => this.modal.close(newProject),
          (err: HttpErrorResponse) => {
            this.form.get('projectName')
              .setErrors({duplicateProjectName: true});
          }
        );
    } else {
    }
  }
}
