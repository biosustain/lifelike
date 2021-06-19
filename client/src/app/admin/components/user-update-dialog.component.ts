import { Component, Input } from '@angular/core';

import {
  FormGroup,
  FormControl,
  Validators, ValidatorFn, AbstractControl,
} from '@angular/forms';


import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { AppUser, UserUpdateRequest } from '../../interfaces';

@Component({
  selector: 'app-user-update-dialog',
  templateUrl: './user-update-dialog.component.html',
})
export class UserUpdateDialogComponent extends CommonFormDialogComponent {
  user: AppUser;
  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    roles: new FormControl('')

  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): UserUpdateRequest {
    const userData = {hashId: this.user.hashId};
    Object.keys(this.form.controls)
            .forEach(key => {
                const currentControl = this.form.controls[key];
                if (currentControl.value !== this.user[key]) {
                        userData[key] = currentControl.value;
                }
            });
    return userData;
  }

  setUser(user: AppUser) {
    this.user = user;
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      roles: (this.user.roles.includes('admin') ? 'admin' : 'user')
    });
  }

}

