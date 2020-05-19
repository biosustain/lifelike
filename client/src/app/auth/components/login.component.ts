import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store';

import { AuthActions } from '../store';
import { MatDialog } from '@angular/material';
import { TermsOfServiceDialogComponent } from 'app/users/components/terms-of-service-dialog/terms-of-service-dialog.component';
import { AccountService } from 'app/users/services/account.service';



@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  });

  constructor(
    private store: Store<State>,
    public dialog: MatDialog,
    private accService: AccountService
  ) { }

  /**
   * Call login API for jwt credential
   */
  submit() {
    const { email, password } = this.form.value;
    // TODO - uncomment and integrate with logic
    // this.store.dispatch(AuthActions.login({credential: {email, password}}));

    // TODO - Setup logic prompt user for the dialog
    //        if no cookie exist or is out of date
    const cookie = this.accService.getCookie('terms_of_service');

    // If terms-of-service cookie doesn't exist or is out of date
    // .. prompt dialog for use to accept terms of service
    // TODO - check if cookie is out of date
    if (!cookie) {
      const dialogRef = this.dialog.open(TermsOfServiceDialogComponent, {
        width: '70%'
      });

      dialogRef.afterClosed().subscribe(
        acceptedVersion => {
          if (acceptedVersion) {
            // continue with login process & create cookie
            this.accService.setCookie('terms_of_service', acceptedVersion);
          } else {
            // complain and do nothing? or snackbar?
            console.log('do nothing');
          }
        }
      );
    } else {
      console.log('you already accepted');
    }
  }
}
