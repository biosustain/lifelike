import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { PdfFile } from '../../interfaces/pdf-files.interface';

@Component({
  selector: 'app-dialog-confirm-deletion',
  templateUrl: './file-delete-dialog.component.html',
})
export class FileDeleteDialogComponent extends CommonDialogComponent {
  @Input() files: PdfFile[];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): PdfFile[] {
    return this.files;
  }
}
