import { Injectable } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageDialogComponent } from '../components/message-dialog/message-dialog.component';

export interface MessageArguments {
  title: string;
  message: string;
  detail?: string;
  type: MessageType;
}

@Injectable({
  providedIn: '***ARANGO_USERNAME***',
})
export class MessageDialog {
  constructor(
    public dialog: MatDialog
  ) {
  }

  display(args: MessageArguments) {
    const dialogConfig = new MatDialogConfig();

    dialogConfig.width = args.detail ? '800px' : '400px';
    dialogConfig.disableClose = false;
    dialogConfig.autoFocus = true;
    dialogConfig.data = {
      title: args.title,
      message: args.message,
      detail: args.detail,
      type: args.type,
    };

    this.dialog.open(MessageDialogComponent, dialogConfig);
  }
}
