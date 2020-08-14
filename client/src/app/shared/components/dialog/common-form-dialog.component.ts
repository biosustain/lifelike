import { MessageType } from '../../../interfaces/message-dialog.interface';
import { AbstractControl } from '@angular/forms';
import { CommonDialogComponent } from './common-dialog.component';

/**
 * An abstract component for dialogs that use forms.
 */
export abstract class CommonFormDialogComponent extends CommonDialogComponent {
  form: AbstractControl;

  submit(): void {
    if (!this.form.invalid) {
      super.submit();
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
}
