import { Component } from '@angular/core';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-reset-password-dialog',
  templateUrl: './reset-password-dialog.component.html'
})
export class ResetPasswordDialogComponent  extends CommonFormDialogComponent {

  readonly form: FormGroup = new FormGroup({
        email: new FormControl('', [Validators.required, Validators.email]),
  });
  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): any {
    return {
      ...this.form.value,
    };
  }


}
