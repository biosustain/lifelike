import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { AppUser} from 'app/interfaces';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import * as UserActions from '../store/actions';
import { Store } from '@ngrx/store';
import { State } from '../../***ARANGO_USERNAME***-store';

@Component({
  selector: 'app-user-security',
  templateUrl: './user-security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSecurityComponent {
  @Input() user: AppUser;

  readonly errors = {
    notMatch: 'Your two passwords don\'t match.',
  };

  readonly form = new FormGroup({
    oldPassword: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
    passwordConfirm: new FormControl('', [Validators.required]),
  }, {validators: this.passConfirmValidator});

  constructor(
    private readonly store: Store<State>,
    private readonly messageDialog: MessageDialog,
  ) {
  }

  passConfirmValidator(form: FormGroup) {
    const password = form.get('password').value as string;
    const confirmPass = form.get('passwordConfirm').value as string;
    if (password !== confirmPass) {
      form.get('passwordConfirm').setErrors({notMatch: true});
    }
    return null;
  }

  changePassword() {
    if (!this.form.invalid) {
      // TODO: Add progress dialog
      const password = this.form.get('oldPassword').value;
      const newPassword = this.form.get('password').value;
      this.store.dispatch(UserActions.updateUser({
        userUpdates: {
          ...this.user,
          newPassword,
          password,
        },
      }));
      this.form.reset();
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
}
