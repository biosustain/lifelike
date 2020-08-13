import { Component} from '@angular/core';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-map-export-dialog',
  templateUrl: './map-export-dialog.component.html',
})
export class MapExportDialogComponent extends CommonFormDialogComponent {
  readonly form: FormGroup = new FormGroup({
    format: new FormControl('', Validators.required),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): string {
    return this.form.get('format').value;
  }
}
