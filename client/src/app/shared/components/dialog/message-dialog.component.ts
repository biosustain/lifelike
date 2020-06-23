import { Component, Input } from '@angular/core';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

/**
 * A generic alert dialog.
 */
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss'],
})
export class MessageDialogComponent {
  @Input() title: string;
  @Input() message: string;
  @Input() detail: string;
  @Input() type: MessageType;

  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  close() {
    this.modal.dismiss();
  }
}
