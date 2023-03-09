import { EventEmitter } from "@angular/core";
import { AbstractControl } from "@angular/forms";

import { MessageType } from "app/interfaces/message-dialog.interface";

import { MessageArguments, MessageDialog } from "../../services/message-dialog.service";

export abstract class FormComponent<O> {
  abstract form: AbstractControl;
  abstract formResult: EventEmitter<O>;

  set params(params: O) {
    if (params != null) {
      this.form.patchValue(params);
    }
  }

  constructor(protected readonly messageDialog: MessageDialog) {}

  submit() {
    if (!this.form.invalid) {
      this.formResult.emit({ ...this.form.value });
    } else {
      this.messageDialog.display({
        title: "Invalid Input",
        message: "There are some errors with your input.",
        type: MessageType.Error,
      } as MessageArguments);
    }
  }
}
