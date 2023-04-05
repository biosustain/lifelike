import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';
import { ErrorLog } from 'app/shared/schemas/common';

import { MessageArguments } from '../../services/message-dialog.service';

/**
 * A generic alert dialog.
 */
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss'],
})
export class MessageDialogComponent {
  @Input() type: MessageType;
  @Input() error: ErrorLog;

  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }
}
