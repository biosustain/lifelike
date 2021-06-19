import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AppUser, PrivateAppUser, UserUpdateRequest } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { AccountService } from '../services/account.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { BackgroundTask } from '../../shared/rxjs/background-task';
import { ResultList } from '../../shared/schemas/common';
import { userUpdated } from '../../auth/store/actions';
import { select, Store } from '@ngrx/store';
import { State } from '../../root-store';
import { AuthActions, AuthSelectors } from '../../auth/store';


@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class UserProfileComponent implements OnInit  {

  user: AppUser;

  form = new FormGroup({
    username: new FormControl({value: 'username', disabled: false}),
    firstName: new FormControl({value: 'First Name', disabled: false}),
    lastName: new FormControl({value: 'Last Name', disabled: false}),
    email: new FormControl({value: '', disabled: true}),
  });

  constructor(private readonly accountService: AccountService,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler,
              private store: Store<State>) {
  }

  ngOnInit() {
   this.store.pipe(select(AuthSelectors.selectAuthUser)).subscribe(user => {
     this.user = user;
     this.reset();
   });
  }

  getValue(): UserUpdateRequest {
    const userData = {hashId: this.user.hashId};
    Object.keys(this.form.controls)
            .forEach(key => {
                const currentControl = this.form.controls[key];
                if (currentControl.value !== this.user[key] && currentControl.value !== '') {
                        userData[key] = currentControl.value;
                }
            });
    return userData;
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
    const updatedUser = this.getValue();
    this.accountService.updateUser(updatedUser)
    .pipe(this.errorHandler.create({label: 'Update user'}))
    .subscribe(() => {
      progressDialogRef.close();
      this.user = Object.assign({}, this.user, updatedUser);
      this.store.dispatch(AuthActions.userUpdated(
          {user: this.user},
        ));
      this.reset();

      this.snackBar.open(
        `You data has been updated successfully!`,
        'close',
        {duration: 5000},
      );
    }, () => {
      progressDialogRef.close();
    });
  }

}
