import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonDialogComponent } from 'app/shared/modules/dialog/components/common/common-dialog.component';
import { MessageDialog } from 'app/shared/modules/dialog/services/message-dialog.service';

import { FilesystemObject } from '../../models/filesystem-object';

/**
 * @see FilesystemObjectActions#openFileAnnotationHistoryDialog
 */
@Component({
  selector: 'app-object-annotation-history-dialog',
  templateUrl: './file-annotation-history-dialog.component.html',
})
export class FileAnnotationHistoryDialogComponent extends CommonDialogComponent<void> {
  @Input() object: FilesystemObject;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue() {}
}
