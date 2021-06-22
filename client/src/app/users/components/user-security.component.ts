import {
  ChangeDetectionStrategy,
  Component, EventEmitter,
  Input, Output,
} from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { AppUser} from 'app/interfaces';
import { MessageType } from '../../interfaces/message-dialog.interface';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import * as UserActions from '../store/actions';
import { Store } from '@ngrx/store';
import { State } from '../../***ARANGO_USERNAME***-store';
import { emit } from 'cluster';

@Component({
  selector: 'app-user-security',
  templateUrl: './user-security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSecurityComponent {
  @Input() user: AppUser;
  @Output() passwordChanged: EventEmitter<boolean> = new EventEmitter();

  readonly errors = {
    notMatch: 'Your two passwords don\'t match.',
  };
  readonly  MIN_PASSWORD_LENGTH = 8;

  readonly form = new FormGroup({
    oldPassword: new FormControl('', [Validators.required]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(this.MIN_PASSWORD_LENGTH),
    ]),
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
      this.store.dispatch(UserActions.changePassword({
        userUpdates: {
          hashId: this.user.hashId,
          newPassword,
          password,
        },
      }));
      this.form.reset();
      this.passwordChanged.emit(true);
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
