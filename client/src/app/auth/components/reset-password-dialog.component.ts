import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/modules/dialog/components/common/common-form-dialog.component';
import { MessageDialog } from 'app/shared/modules/dialog/services/message-dialog.service';

interface ResetPasswordDialogFormValue {
  email: string;
}

@Component({
  selector: 'app-reset-password-dialog',
  templateUrl: './reset-password-dialog.component.html',
})
export class ResetPasswordDialogComponent extends CommonFormDialogComponent<ResetPasswordDialogFormValue> {
  readonly form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });
  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue() {
    return {
      ...this.form.value,
    };
  }
}
