import { Component } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ofType } from '@ngrx/effects';

import { MessageDialog } from 'app/shared/modules/dialog/services/message-dialog.service';
import { CommonDialogComponent } from 'app/shared/modules/dialog/components/common/common-dialog.component';
import { PrivateAppUser } from 'app/interfaces';

import { AccountService } from '../services/account.service';
import * as UserActions from '../store/actions';
import { UserEffects } from '../store/effects';

@Component({
  selector: 'app-change-password-dialog',
  templateUrl: './change-password-dialog.component.html',
})
export class ChangePasswordDialogComponent extends CommonDialogComponent<boolean> {
  user: PrivateAppUser;

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
    private readonly accountService: AccountService,
    private readonly userEffects: UserEffects
  ) {
    super(modal, messageDialog);
    this.accountService.currentUser().subscribe((user) => (this.user = user));
    this.userEffects.actions$
      .pipe(ofType(UserActions.changePasswordSuccess))
      .subscribe(() => this.submit());
  }

  getValue(): boolean {
    return true;
  }
}
