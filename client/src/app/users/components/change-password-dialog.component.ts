import {
  AfterContentInit,
  AfterViewInit,
  Component,
  ContentChild, ContentChildren,
  OnInit,
  QueryList,
  ViewChild,
} from '@angular/core';

import { MessageDialog } from '../../shared/services/message-dialog.service';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UserSecurityComponent } from './user-security.component';
import { AppUser } from '../../interfaces';
import { AccountService } from '../services/account.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-change-password-dialog',
  templateUrl: './change-password-dialog.component.html'
})
export class ChangePasswordDialogComponent extends CommonDialogComponent {

  user: AppUser;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              private readonly accountService: AccountService) {
    super(modal, messageDialog);
    this.accountService.currentUser().subscribe(user => this.user = user);
  }

  getValue(): boolean {
    return true;
  }

}

