import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageType } from '../../../interfaces/message-dialog.interface';
import { AbstractControl } from '@angular/forms';
import { MessageDialog } from '../../services/message-dialog.service';

/**
 * An abstract component for dialogs.
 */
export abstract class CommonDialogComponent {
  form: AbstractControl;

  constructor(public readonly modal: NgbActiveModal,
              public readonly messageDialog: MessageDialog) {
  }

  /**
   * Get the return value for submission.
   */
  abstract getValue(): any;

  cancel() {
    this.modal.dismiss();
  }

  submit(): void {
    this.modal.close(this.getValue());
  }
}
