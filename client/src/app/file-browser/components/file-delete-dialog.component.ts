import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonDialogComponent } from '../../shared/components/dialog/common-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';
import { PdfFile } from '../../interfaces/pdf-files.interface';
import { File } from './file-browser.component';
import { Directory, Map } from '../services/project-space.service';

@Component({
  selector: 'app-dialog-confirm-deletion',
  templateUrl: './file-delete-dialog.component.html',
})
export class FileDeleteDialogComponent extends CommonDialogComponent {
  @Input() files: (File|Map|Directory)[];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): (File|Map|Directory)[] {
    return this.files;
  }
}
