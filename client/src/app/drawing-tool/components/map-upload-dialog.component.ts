import { Component} from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { DrawingUploadPayload } from 'app/interfaces/drawing.interface';

import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-map-upload-dialog',
  templateUrl: './map-upload-dialog.component.html',
})
export class MapUploadDialogComponent extends CommonFormDialogComponent {
  payload: File[];
  pickedFileName: string;
  directoryId = 1; // TODO: Create a directory GUI here - LL-415

  readonly form: FormGroup = new FormGroup({
    label: new FormControl('', Validators.required),
    description: new FormControl(''),
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  selectFile(fileList: FileList) {
    this.payload = Array.from(fileList);
    this.pickedFileName = fileList.length ? fileList[0].name : '';
  }

  getValue(): DrawingUploadPayload {
    console.log(this.form.value);
    return {
      label: this.form.get('label').value,
      files: this.payload,
      filename: this.pickedFileName,
      dirId: this.directoryId,
      description: this.form.get('description').value,
    } as DrawingUploadPayload;
  }
}
