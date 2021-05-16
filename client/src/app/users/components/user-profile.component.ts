import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AppUser,  UserUpdateRequest } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { AccountService } from '../services/account.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorHandler } from '../../shared/services/error-handler.service';


@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileComponent implements OnInit  {

  @Input() user: AppUser;

  form = new FormGroup({
    username: new FormControl({value: '', disabled: false}),
    firstName: new FormControl({value: '', disabled: false}),
    lastName: new FormControl({value: '', disabled: false}),
    email: new FormControl({value: '', disabled: true}),
  });

  constructor(private readonly accountService: AccountService,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler) {
  }

  ngOnInit() {
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
    });
  }

  getValue(): UserUpdateRequest {
    return {
      ...this.form.value,
    };
  }
  reset() {
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
    });
  }


  submit() {
    const progressDialogRef = this.progressDialog.display({
            title: `Updating User`,
            progressObservable: new BehaviorSubject<Progress>(new Progress({
              status: 'Updating user...',
            })),
          });
    this.accountService.updateUser(this.getValue())
    .pipe(this.errorHandler.create({label: 'Update user'}))
    .subscribe((user: AppUser) => {
      progressDialogRef.close();
      this.accountService.getUserList();
      this.user = user;
      this.snackBar.open(
        `User ${user.username} updated!`,
        'close',
        {duration: 5000},
      );
    }, () => {
      progressDialogRef.close();
    });
    this.reset();
  }

}
