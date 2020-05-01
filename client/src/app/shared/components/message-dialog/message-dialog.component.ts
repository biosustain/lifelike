import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MessageType } from 'app/interfaces/message-dialog.interface';

/**
 * A generic alert dialog.
 */
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss'],
})
export class MessageDialogComponent {
  title: string;
  message: string;
  detail: string;
  type: MessageType;

  constructor(private dialogRef: MatDialogRef<MessageDialogComponent>,
              @Inject(MAT_DIALOG_DATA) data) {
    this.title = data.title;
    this.message = data.message;
    this.detail = data.detail;
    this.type = data.type;
  }
}
