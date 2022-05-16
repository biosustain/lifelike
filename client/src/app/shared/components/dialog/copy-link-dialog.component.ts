import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageArguments, MessageDialog } from '../../services/message-dialog.service';

@Component({
  selector: 'app-share-dialog',
  templateUrl: './copy-link-dialog.component.html',
})
export class CopyLinkDialogComponent {
  @Input() url: string;

  constructor(public readonly modal: NgbActiveModal) {
  }

  close(): void {
    this.modal.close();
  }
}
