import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';
import { State } from 'app/***ARANGO_USERNAME***-store';

import { AuthActions } from '../store';
import { MatDialog, MatSnackBar } from '@angular/material';
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
    private accService: AccountService,
    private snackBar: MatSnackBar
  ) { }

  /**
   * Call login API for jwt credential
   */
  submit() {
    const { email, password } = this.form.value;

    this.store.dispatch(
      AuthActions.login(
        {credential: {email, password}}
      )
    );
  }
}
