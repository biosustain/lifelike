import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { AuthActions } from '../store';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  constructor(
    private store: Store<State>,
    private readonly messageDialog: MessageDialog,
  ) {
  }

  submit() {
    if (!this.form.invalid) {
      const {email, password} = this.form.value;

      this.store.dispatch(
        AuthActions.checkTermsOfService(
          {credential: {email, password}},
        ),
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
