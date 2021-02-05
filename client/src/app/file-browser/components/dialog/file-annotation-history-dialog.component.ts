import { Component, Input } from '@angular/core';
import { FilesystemObject } from '../../models/filesystem-object';
import { CommonDialogComponent } from '../../../shared/components/dialog/common-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../../shared/services/message-dialog.service';

/**
 * @see FilesystemObjectActions#openFileAnnotationHistoryDialog
 */
@Component({
  selector: 'app-object-annotation-history-dialog',
  templateUrl: './file-annotation-history-dialog.component.html',
})
export class FileAnnotationHistoryDialogComponent extends CommonDialogComponent {

  @Input() object: FilesystemObject;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): any {
  }

}
