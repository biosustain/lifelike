import { Component } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';

@Component({
  selector: 'app-dialog-confirm-deletion-reqursive',
  templateUrl: './object-delete-reqursive-dialog.component.html',
})
export class ObjectDeleteReqursiveDialogComponent {
  constructor(private modal: NgbActiveModal, messageDialog: MessageDialog) {
  }

  cancel() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }
}
