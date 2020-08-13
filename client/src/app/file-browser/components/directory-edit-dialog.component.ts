import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Directory } from '../services/project-space.service';

@Component({
  selector: 'app-directory-edit-dialog',
  templateUrl: './directory-edit-dialog.component.html',
})
export class DirectoryEditDialogComponent extends CommonFormDialogComponent {
  @Input() editing = false;

  form: FormGroup = new FormGroup({
    name: new FormControl('', Validators.required),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  @Input() set directory(directory: Directory) {
    this.form.patchValue({
      name: directory.name,
    });
  }

  getValue(): Directory {
    return {
      ...this.form.value,
    };
  }
}
