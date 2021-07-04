import { Component, OnInit } from '@angular/core';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { AppUser } from '../../interfaces';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-missing-roles-dialog',
  templateUrl: './missing-roles-dialog.component.html'
})
export class MissingRolesDialogComponent extends CommonFormDialogComponent {

  usernames: string[];
  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    roles: new FormControl('')

  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue() {
      return true;
  }

  setUsers(usernames: string[]) {
    this.usernames = usernames;
  }
}
