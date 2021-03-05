import { Component } from '@angular/core';

import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { UserCreationRequest } from '../../interfaces';

@Component({
  selector: 'app-user-create-dialog',
  templateUrl: 'user-create-dialog.component.html',
})
export class UserCreateDialogComponent extends CommonFormDialogComponent {
  readonly MIN_PASSWORD_LENGTH = 8;
  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(this.MIN_PASSWORD_LENGTH),
    ]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): UserCreationRequest {
    return {
      ...this.form.value,
      roles: [],
    };
  }
}
