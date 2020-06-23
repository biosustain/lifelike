import { Component, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  FormGroup,
  FormGroupDirective,
  FormControl,
  Validators,
} from '@angular/forms';

import { AccountService } from 'app/users/services/account.service';
import { AppUser, UserCreationRequest } from 'app/interfaces';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';

/**
 * A dialog for creating users.
 */
@Component({
  selector: 'app-user-creation-dialog',
  templateUrl: 'user-creation-dialog.component.html',
})
export class UserCreationDialogComponent {
  @ViewChild(FormGroupDirective, {static: false}) formGroupDirective: FormGroupDirective;

  readonly MIN_PASSWORD_LENGTH = 8;
  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    password: new FormControl(
      '', [Validators.required, Validators.minLength(this.MIN_PASSWORD_LENGTH)]),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  constructor(
    private readonly accountService: AccountService,
    private readonly snackBar: MatSnackBar,
    private readonly modal: NgbActiveModal,
    private readonly messageDialog: MessageDialog,
    private readonly progressDialog: ProgressDialog,
  ) {
  }

  /**
   * Close the dialog without creating anything.
   */
  close() {
    this.modal.dismiss();
  }

  /**
   * Create a user based on the form input.
   */
  submit() {
    if (!this.form.invalid) {
      const progressDialogRef = this.progressDialog.display({
        title: `Creating User`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Creating user...',
        })),
      });

      this.accountService.createUser({
        firstName: this.form.value.firstName,
        lastName: this.form.value.lastName,
        username: this.form.value.username,
        password: this.form.value.password,
        email: this.form.value.email,
      } as UserCreationRequest).subscribe(
        (user: AppUser) => {
          progressDialogRef.close();
          this.close();
          this.accountService.getUserList();
          this.formGroupDirective.resetForm();
          this.snackBar.open(
            `User ${user.username} created!`,
            'close',
            {duration: 5000},
          );
        },
        () => {
          progressDialogRef.close();
        }
      );
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
}
