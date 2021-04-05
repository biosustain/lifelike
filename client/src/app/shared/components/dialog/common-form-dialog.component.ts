import { MessageType } from '../../../interfaces/message-dialog.interface';
import { AbstractControl } from '@angular/forms';
import { CommonDialogComponent } from './common-dialog.component';
import { MessageArguments } from 'app/shared/services/message-dialog.service';

/**
 * An abstract component for dialogs that use forms.
 */
export abstract class CommonFormDialogComponent<T = any, V = T> extends CommonDialogComponent<T, V> {
  form: AbstractControl;

  submit(): void {
    if (!this.form.invalid) {
      super.submit();
    } else {
      this.form.markAsDirty();
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }
}
