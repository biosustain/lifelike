import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../services/message-dialog.service';
import { MessageType } from '../../../interfaces/message-dialog.interface';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-share-dialog',
  templateUrl: './share-dialog.component.html',
})
export class ShareDialogComponent {

  @ViewChild('input', {static: false}) input: ElementRef;
  @Input() url: string;

  constructor(public readonly modal: NgbActiveModal,
              public readonly messageDialog: MessageDialog,
              public readonly snackBar: MatSnackBar) {
  }

  copyToClipboard() {
    if (this.input) {
      this.input.nativeElement.focus();
      this.input.nativeElement.select();
      if (document.execCommand('copy')) {
        this.snackBar.open('Copied to clipboard.', null, {
          duration: 3000,
        });
        return;
      }
    }

    this.messageDialog.display({
      type: MessageType.Error,
      title: 'Error',
      message: 'Copy failed. Please copy with your keyboard.',
    });
  }

  close(): void {
    this.modal.close();
  }

}
