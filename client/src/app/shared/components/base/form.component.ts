import { AbstractControl } from '@angular/forms';
import { MessageType } from '../../../interfaces/message-dialog.interface';
import { MessageDialog } from '../../services/message-dialog.service';
import { EventEmitter, Input } from '@angular/core';

export abstract class FormComponent<O> {
  abstract form: AbstractControl;
  abstract formResult: EventEmitter<O>;

  constructor(protected readonly messageDialog: MessageDialog) {
  }

  set params(params: O) {
    if (params != null) {
      this.form.patchValue(params);
    }
  }

  submit() {
    if (!this.form.invalid) {
      this.formResult.emit({...this.form.value});
    } else {
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      });
    }
  }
}
