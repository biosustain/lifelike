import { Platform } from '@angular/cdk/platform';
import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { Store } from '@ngrx/store';
import { State } from 'app/root-store';

import { AuthActions } from '../store';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageArguments, MessageDialog } from '../../shared/services/message-dialog.service';

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
}
