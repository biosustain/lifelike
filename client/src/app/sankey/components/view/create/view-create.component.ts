import { Component } from "@angular/core";
import { FormControl, FormGroup, ValidationErrors, Validators } from "@angular/forms";

import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";

import { CommonFormDialogComponent } from "app/shared/components/dialog/common-form-dialog.component";
import { ObjectEditDialogValue } from "app/file-browser/components/dialog/object-edit-dialog.component";
import { MessageDialog } from "app/shared/services/message-dialog.service";

@Component({
  selector: "app-sankey-view-confirm",
  templateUrl: "./view-create.component.html",
})
export class SankeyViewCreateComponent extends CommonFormDialogComponent<ObjectEditDialogValue> {
  readonly form: FormGroup = new FormGroup(
    {
      viewName: new FormControl("", Validators.required),
    },
    (group: FormGroup): ValidationErrors | null => {
      return null;
    }
  );

  constructor(public readonly modal: NgbActiveModal, public readonly messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): ObjectEditDialogValue {
    return this.form.value;
  }
}
