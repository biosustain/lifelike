import { Component } from '@angular/core';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-annotation-exclude-dialog',
  templateUrl: './annotation-exclude-dialog.component.html',
})
export class AnnotationExcludeDialogComponent extends CommonFormDialogComponent {
  readonly reasonChoices = [
    'Not an entity',
    'Wrong annotation type',
    'Exclude from the synonym list',
    'Other',
  ];

  readonly form: FormGroup = new FormGroup({
    reason: new FormControl(this.reasonChoices[0], Validators.required),
    comment: new FormControl(''),
    excludeGlobally: new FormControl(false),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): any {
    return {
      ...this.form.value,
    };
  }

  chooseReason(reason: string, checked: boolean) {
    if (checked) {
      this.form.get('reason').setValue(reason);
    }
  }
}
