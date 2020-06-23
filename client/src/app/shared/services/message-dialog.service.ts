import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialogComponent } from '../components/message-dialog/message-dialog.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UserCreationDialogComponent } from '../../admin/components/user-creation-dialog.component';

export interface MessageArguments {
  title: string;
  message: string;
  detail?: string;
  type: MessageType;
}

@Injectable({
  providedIn: 'root',
})
export class MessageDialog {
  constructor(
    private modalService: NgbModal,
  ) {
  }

  display(args: MessageArguments) {
    const modalRef = this.modalService.open(MessageDialogComponent, {
      size: args.detail ? 'lg' : 'md',
    });
    modalRef.componentInstance.title = args.title;
    modalRef.componentInstance.message = args.message;
    modalRef.componentInstance.detail = args.detail;
    modalRef.componentInstance.type = args.type;
  }
}
