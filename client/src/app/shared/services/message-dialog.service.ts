import { Injectable } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageDialogComponent } from '../components/dialog/message-dialog.component';
import { ErrorLog } from '../schemas/common';

export interface MessageArguments extends ErrorLog {
  type: MessageType;
}

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class MessageDialog {
  constructor(private modalService: NgbModal) {}

  display({ type, ...error }: MessageArguments) {
    const modalRef = this.modalService.open(MessageDialogComponent, {
      size: error.stacktrace ? 'lg' : 'md',
    });
    Object.assign(modalRef.componentInstance, { type, error });
    return modalRef.result;
  }
}
