import { Component } from '@angular/core';

import { MessageDialog } from '../../shared/services/message-dialog.service';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PrivateAppUser } from '../../interfaces';
import { AccountService } from '../services/account.service';
import { ofType } from '@ngrx/effects';
import * as UserActions from '../store/actions';
import { map } from 'rxjs/operators';
import { SnackbarActions } from '../../shared/store';
import { UserEffects } from '../store/effects';

@Component({
  selector: 'app-change-password-dialog',
  templateUrl: './change-password-dialog.component.html'
})
export class ChangePasswordDialogComponent extends CommonDialogComponent {
  user: PrivateAppUser;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              private readonly accountService: AccountService,
              private readonly userEffects: UserEffects) {
    super(modal, messageDialog);
    this.accountService.currentUser().subscribe(user => this.user = user);
    this.userEffects.actions$.pipe(ofType(UserActions.changePasswordSuccess)).subscribe(() => this.submit());
  }

  getValue(): boolean {
    return true;
  }

}

