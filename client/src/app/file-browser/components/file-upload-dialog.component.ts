import { Component } from '@angular/core';
import { UploadPayload, UploadType } from '../../interfaces/pdf-files.interface';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonFormDialogComponent } from '../../shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from '../../shared/services/message-dialog.service';

@Component({
  selector: 'app-dialog-upload',
  templateUrl: './file-upload-dialog.component.html',
})
export class FileUploadDialogComponent extends CommonFormDialogComponent {
  readonly uploadType = UploadType;
  readonly form: FormGroup = new FormGroup({
    type: new FormControl(''),
    files: new FormControl(''),
    url: new FormControl(''),
    filename: new FormControl('', [
      (control: AbstractControl): { [key: string]: any } | null => { // Validate against whitespace-only strings
        const filename = control.value;
        const forbidden = filename.trim().length <= 0;
        return forbidden ? {required: {value: filename}} : null;
      },
    ]),
    description: new FormControl(''),
  }, [
    (form: FormGroup) => {
      if (form.value.type === UploadType.Files) {
        return Validators.required(form.get('files'));
      } else if (form.value.type === UploadType.Url) {
        return Validators.required(form.get('url'));
      } else {
        return null;
      }
    }
  ]);
  activeTab = UploadType.Files;

  private static extractFilename(s: string): string {
    s = s.replace(/^.*[/\\]/, '').trim().replace(/ +/g, '_');
    if (s.length) {
      return s;
    } else {
      return 'document.pdf';
    }
  }

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
    this.form.patchValue({
      type: this.activeTab,
      files: [],
    });
  }

  activeTabChanged(newId) {
    this.form.get('type').setValue(newId);
    this.form.get('files').setValue([]);
  }

  fileChanged(event) {
    if (event.target.files.length) {
      const file = event.target.files[0];
      this.form.get('files').setValue([file]);
      this.form.get('filename').setValue(file.name);
    } else {
      this.form.get('files').setValue(null);
    }
  }

  urlChanged(event) {
    this.form.get('filename').setValue(FileUploadDialogComponent.extractFilename(event.target.value));
  }

  getValue(): UploadPayload {
    return {
      ...this.form.value,
    };
  }
}
