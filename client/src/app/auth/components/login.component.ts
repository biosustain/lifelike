import { Platform } from '@angular/cdk/platform';
import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store';

import { AuthActions } from '../store';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { BehaviorSubject } from 'rxjs';
import { Progress } from '../../interfaces/common-dialog.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProgressDialog } from '../../shared/services/progress-dialog.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorHandler } from '../../shared/services/error-handler.service';
import { ResetPasswordDialogComponent } from './reset-password-dialog.component';
import { AccountService } from '../../users/services/account.service';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  unsupportedBrowser: boolean;

  constructor(
    private store: Store<State>,
    private readonly messageDialog: MessageDialog,
    private readonly platform: Platform,
    private readonly modalService: NgbModal,
    private readonly progressDialog: ProgressDialog,
    private readonly snackBar: MatSnackBar,
    private readonly errorHandler: ErrorHandler,
    private readonly accountService: AccountService
  ) {
    this.unsupportedBrowser = this.platform.SAFARI; // Add additional browsers here as necessary
  }

  submit() {
    if (!this.form.invalid) {
      const {email, password} = this.form.value;

      this.store.dispatch(AuthActions.checkTermsOfService(
        {credential: {email, password}},
      ));

      this.form.get('password').reset('');
    } else {
      this.form.markAsDirty();
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }

  displayResetDialog() {
    const modalRef = this.modalService.open(ResetPasswordDialogComponent);
    modalRef.result.then(email => {
      const progressDialogRef = this.progressDialog.display({
        title: `Sending request`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Sending request...',
        })),
      });
      this.accountService.resetPassword(email.email)
        .pipe()
        .subscribe(() => {
          progressDialogRef.close();
          this.snackBar.open(
            `Email sent. Please check your inbox.`,
            'close',
            {duration: 5000},
          );
        }, () => {
          progressDialogRef.close();
          this.snackBar.open(
            `Unable to reset the password due to the error.\n
            Please try again or contact the administration if the issue persist.`,
            'close',
            {duration: 5000},
          );
        });
    }, () => {
    });
  }
}
